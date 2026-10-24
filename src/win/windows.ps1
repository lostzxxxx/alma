# Janelas do Windows para a hotbar da Alma: listar apps abertos, focar/minimizar, fechar e abrir o Iniciar.
# Protocolo: uma linha JSON por comando no stdin; uma linha JSON por resposta no stdout.
#   {"id":1,"cmd":"list"}                 -> {"id":1,"ok":true,"data":{"fg":"123","windows":[{hwnd,title,pid,exe,desc,min}]}}
#   {"id":2,"cmd":"focus","hwnd":"123"}   -> traz para a frente (ou minimiza, se já estava na frente)
#   {"id":3,"cmd":"close","hwnd":"123"}   -> pede para a janela fechar (como clicar no X)
#   {"id":4,"cmd":"start"}                -> abre o menu Iniciar
#   {"id":5,"cmd":"appinfo","aumid":"..."} ou {"exe":"..."} -> {exe, logo, aumid} de um app da Store
#   {"id":6,"cmd":"nowplaying","thumbKey":"..."} -> o que está tocando (o mesmo do controle de mídia do Windows)
#   {"id":7,"cmd":"mediactl","action":"play_pause|next|previous"} -> controla essa sessão direto
#   {"id":8,"cmd":"mousedown"}            -> true se algum botão do mouse está apertado (arrastando algo)
#   {"id":9,"cmd":"fullscreen"}           -> retângulo do monitor se o app da frente está em tela cheia, senão null
#   {"id":10,"cmd":"volume","level":35,"muted":false} -> ajusta (campos opcionais) e devolve {level, muted}
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public static class AlmaWin {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder s, ref int size);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

  static readonly HashSet<uint> ownPids = new HashSet<uint>();
  static IntPtr lastExternalFg = IntPtr.Zero; // última janela de outro app que estava na frente
  static readonly Dictionary<string, string> descCache = new Dictionary<string, string>();

  public static void AddOwnPid(uint pid) { ownPids.Add(pid); }

  static string ExeOf(uint pid) {
    IntPtr h = OpenProcess(0x1000, false, pid); // PROCESS_QUERY_LIMITED_INFORMATION
    if (h == IntPtr.Zero) return "";
    try {
      var sb = new StringBuilder(1024); int n = sb.Capacity;
      return QueryFullProcessImageName(h, 0, sb, ref n) ? sb.ToString() : "";
    } finally { CloseHandle(h); }
  }

  static string Desc(string exe) {
    if (string.IsNullOrEmpty(exe)) return "";
    string d;
    if (descCache.TryGetValue(exe, out d)) return d;
    try { d = FileVersionInfo.GetVersionInfo(exe).FileDescription ?? ""; } catch { d = ""; }
    descCache[exe] = d;
    return d;
  }

  static string Esc(string s) {
    var sb = new StringBuilder();
    foreach (char c in s ?? "") {
      if (c == '"' || c == '\\') { sb.Append('\\').Append(c); }
      else if (c < 0x20) { sb.AppendFormat("\\u{0:x4}", (int)c); }
      else sb.Append(c);
    }
    return sb.ToString();
  }

  static bool IsAppWindow(IntPtr h) {
    if (!IsWindowVisible(h) || GetWindowTextLength(h) == 0) return false;
    if (GetWindow(h, 4) != IntPtr.Zero) return false;                 // tem dono (diálogo, popup)
    int ex = GetWindowLong(h, -20);
    if ((ex & 0x80) != 0 && (ex & 0x40000) == 0) return false;        // janela de ferramenta (sem APPWINDOW)
    int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return false; // escondida (outra área de trabalho, app da Store suspenso)
    return true;
  }

  public static string List() {
    IntPtr fg = GetForegroundWindow();
    uint fgPid; GetWindowThreadProcessId(fg, out fgPid);
    if (fg != IntPtr.Zero && !ownPids.Contains(fgPid)) lastExternalFg = fg;
    var sb = new StringBuilder();
    sb.Append("{\"fg\":\"").Append(lastExternalFg.ToInt64()).Append("\",\"windows\":[");
    bool first = true;
    EnumWindows((h, l) => {
      if (!IsAppWindow(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (ownPids.Contains(pid)) return true;
      string exe = ExeOf(pid);
      // apps da Store moram dentro do ApplicationFrameHost: o processo de verdade está numa janela filha
      if (exe.EndsWith("ApplicationFrameHost.exe", StringComparison.OrdinalIgnoreCase)) {
        uint inner = 0;
        EnumChildWindows(h, (c, l2) => { uint p; GetWindowThreadProcessId(c, out p); if (p != pid) { inner = p; return false; } return true; }, IntPtr.Zero);
        if (inner != 0) { pid = inner; exe = ExeOf(inner); }
      }
      string name = System.IO.Path.GetFileName(exe).ToLowerInvariant();
      if (name == "textinputhost.exe" || name == "shellexperiencehost.exe" || name == "searchhost.exe" || name == "startmenuexperiencehost.exe") return true;
      int len = GetWindowTextLength(h); var t = new StringBuilder(len + 1); GetWindowText(h, t, t.Capacity);
      if (t.ToString() == "Program Manager") return true;
      if (!first) sb.Append(',');
      first = false;
      sb.Append("{\"hwnd\":\"").Append(h.ToInt64()).Append("\",\"pid\":").Append(pid)
        .Append(",\"title\":\"").Append(Esc(t.ToString())).Append("\",\"exe\":\"").Append(Esc(exe))
        .Append("\",\"desc\":\"").Append(Esc(Desc(exe))).Append("\",\"min\":").Append(IsIconic(h) ? "true" : "false").Append('}');
      return true;
    }, IntPtr.Zero);
    sb.Append("]}");
    return sb.ToString();
  }

  // Clique na hotbar: se a janela já estava na frente, minimiza; senão restaura e traz para a frente.
  public static string Focus(long hwnd) {
    IntPtr h = new IntPtr(hwnd);
    if (h == lastExternalFg && !IsIconic(h)) { ShowWindow(h, 6); lastExternalFg = IntPtr.Zero; return "minimized"; }
    if (IsIconic(h)) ShowWindow(h, 9);
    // o Windows só deixa trocar o foco depois de um "toque" de teclado: um Alt rápido libera
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    SetForegroundWindow(h);
    lastExternalFg = h;
    return "focused";
  }

  public static void Close(long hwnd) { PostMessage(new IntPtr(hwnd), 0x0010, IntPtr.Zero, IntPtr.Zero); }

  [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
  [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);

  // App em tela cheia (jogo, vídeo, F11) na frente: devolve o retângulo do monitor dele (pixels reais), senão null.
  // Janela maximizada não conta (com a barra de tarefas escondida ela também cobre o monitor inteiro).
  public static string Fullscreen() {
    IntPtr fg = GetForegroundWindow();
    if (fg == IntPtr.Zero || IsZoomed(fg)) return "null";
    uint pid; GetWindowThreadProcessId(fg, out pid);
    if (ownPids.Contains(pid)) return "null";
    var cls = new StringBuilder(256); GetClassName(fg, cls, 256);
    string c = cls.ToString();
    if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") return "null"; // área de trabalho e barra
    if ((GetWindowLong(fg, -16) & 0x00C00000) == 0x00C00000) return "null"; // tem barra de título: janela comum
    RECT r; if (!GetWindowRect(fg, out r)) return "null";
    var mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
    if (!GetMonitorInfo(MonitorFromWindow(fg, 2), ref mi)) return "null";
    var m = mi.rcMonitor;
    if (r.Left > m.Left || r.Top > m.Top || r.Right < m.Right || r.Bottom < m.Bottom) return "null";
    return "{\"left\":" + m.Left + ",\"top\":" + m.Top + ",\"right\":" + m.Right + ",\"bottom\":" + m.Bottom + "}";
  }

  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
  // algum botão do mouse apertado agora (alguém arrastando algo)
  public static bool MouseDown() { return ((GetAsyncKeyState(0x01) | GetAsyncKeyState(0x02)) & 0x8000) != 0; }

  public static void StartMenu() {
    keybd_event(0x5B, 0, 0, UIntPtr.Zero);
    keybd_event(0x5B, 0, 2, UIntPtr.Zero);
  }
}
'@

# Volume do Windows (Core Audio): ler e ajustar o volume e o mudo do alto-falante padrão, com precisão
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown), ComImport]
interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr p);
  int UnregisterControlChangeNotify(IntPtr p);
  int GetChannelCount(out uint c);
  int SetMasterVolumeLevel(float l, ref Guid g);
  int SetMasterVolumeLevelScalar(float l, ref Guid g);
  int GetMasterVolumeLevel(out float l);
  int GetMasterVolumeLevelScalar(out float l);
  int SetChannelVolumeLevel(uint c, float l, ref Guid g);
  int SetChannelVolumeLevelScalar(uint c, float l, ref Guid g);
  int GetChannelVolumeLevel(uint c, out float l);
  int GetChannelVolumeLevelScalar(uint c, out float l);
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool m, ref Guid g);
  int GetMute([MarshalAs(UnmanagedType.Bool)] out bool m);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown), ComImport]
interface IMMDevice {
  int Activate(ref Guid iid, int clsCtx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown), ComImport]
interface IMMDeviceEnumerator {
  int EnumAudioEndpoints(int flow, int mask, out IntPtr devices);
  int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCom {}

public static class AlmaAudio {
  static IAudioEndpointVolume Endpoint() {
    var e = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
    IMMDevice d; Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(0, 1, out d));
    Guid iid = typeof(IAudioEndpointVolume).GUID; object o;
    Marshal.ThrowExceptionForHR(d.Activate(ref iid, 23, IntPtr.Zero, out o));
    return (IAudioEndpointVolume)o;
  }
  public static string Get() {
    var v = Endpoint(); float l; bool m;
    v.GetMasterVolumeLevelScalar(out l); v.GetMute(out m);
    return "{\"level\":" + Math.Round(l * 100) + ",\"muted\":" + (m ? "true" : "false") + "}";
  }
  public static void Set(int percent) { var v = Endpoint(); Guid g = Guid.Empty; v.SetMasterVolumeLevelScalar(Math.Max(0, Math.Min(100, percent)) / 100f, ref g); }
  public static void Mute(bool on) { var v = Endpoint(); Guid g = Guid.Empty; v.SetMute(on, ref g); }
}
'@

function Emit($id, $ok, $data, $err) {
  if ($ok) { $json = '{"id":' + $id + ',"ok":true,"data":' + $data + '}' }
  else { $json = '{"id":' + $id + ',"ok":false,"error":' + ($err | ConvertTo-Json -Compress) + '}' }
  [Console]::Out.WriteLine($json)
  [Console]::Out.Flush()
}

# App da Store: .exe (para reconhecer a janela) e logo (o .exe deles não tem ícone dentro), lendo o manifesto.
# Aceita o AUMID ("Família!App") ou o caminho de um .exe dentro de WindowsApps.
$script:appxCache = @{}
function AppInfo($aumid, $exePath) {
  $key = "$aumid|$exePath"
  if ($script:appxCache.ContainsKey($key)) { return $script:appxCache[$key] }
  $pkgs = Get-AppxPackage
  if ($aumid) {
    $fam, $appId = $aumid.Split('!')
    $pkg = $pkgs | Where-Object { $_.PackageFamilyName -eq $fam } | Select-Object -First 1
  } else {
    $pkg = $pkgs | Where-Object { $_.InstallLocation -and $exePath.StartsWith($_.InstallLocation + '\', [StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1
  }
  $info = @{ exe = ''; logo = ''; logoLight = ''; aumid = '' }
  if ($pkg) {
    [xml]$m = Get-Content -LiteralPath (Join-Path $pkg.InstallLocation 'AppxManifest.xml') -Raw
    $apps = @($m.Package.Applications.Application)
    $a = if ($appId) { $apps | Where-Object { $_.Id -eq $appId } | Select-Object -First 1 }
         else { $apps | Where-Object { $_.Executable -and $exePath.EndsWith('\' + $_.Executable, [StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1 }
    if (-not $a) { $a = $apps | Select-Object -First 1 }
    if ($a) {
      if ($a.Executable) { $info.exe = Join-Path $pkg.InstallLocation $a.Executable }
      $info.aumid = "$($pkg.PackageFamilyName)!$($a.Id)"
      $logo = $a.VisualElements.Square44x44Logo
      if ($logo) {
        $dir = Join-Path $pkg.InstallLocation (Split-Path $logo)
        $stem = [IO.Path]::GetFileNameWithoutExtension($logo)
        $files = @(Get-ChildItem -LiteralPath $dir -Filter "$stem*.png" -ErrorAction SilentlyContinue)
        # preferência: tamanho próximo de 32-48 px e sem a placa de fundo ("altform-unplated")
        foreach ($pat in 'targetsize-48_altform-unplated', 'targetsize-32_altform-unplated', 'targetsize-48', 'targetsize-32', 'scale-200', 'scale-100', '') {
          $hit = $files | Where-Object { $_.Name -like "*$pat*" -and $_.Name -notlike '*contrast*' -and $_.Name -notlike '*lightunplated*' } | Select-Object -First 1
          if ($hit) { $info.logo = $hit.FullName; break }
        }
        # versão para fundo claro (o Windows usa na barra de tarefas clara)
        foreach ($pat in 'targetsize-48_altform-lightunplated', 'targetsize-32_altform-lightunplated') {
          $hit = $files | Where-Object { $_.Name -like "*$pat*" } | Select-Object -First 1
          if ($hit) { $info.logoLight = $hit.FullName; break }
        }
      }
    }
  }
  $script:appxCache[$key] = $info
  return $info
}

# ---------- tocando agora (sessões de mídia do Windows: Spotify, navegador, players…) ----------
# Carregado só no primeiro uso. As APIs do Windows são assíncronas; Await espera o resultado.
$script:gsmtc = $null
function MediaManager {
  if ($script:gsmtc) { return $script:gsmtc }
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $script:asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  [void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $script:gsmtc = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  return $script:gsmtc
}
function Await($op, [type]$t) {
  $task = $script:asTask.MakeGenericMethod($t).Invoke($null, @($op))
  if (-not $task.Wait(4000)) { throw 'O Windows demorou para responder' }
  $task.Result
}

$script:thumbCache = @{ key = ''; data = '' }
function NowPlaying($knownThumb) {
  $s = (MediaManager).GetCurrentSession()
  if (-not $s) { return 'null' }
  $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $info = $s.GetPlaybackInfo()
  $tl = $s.GetTimelineProperties()
  $key = "$($s.SourceAppUserModelId)|$($p.Title)|$($p.Artist)|$($p.AlbumTitle)"
  # capa: lida uma vez por música; só vai na resposta se quem pediu ainda não tem
  if ($key -ne $script:thumbCache.key) {
    $script:thumbCache = @{ key = $key; data = '' }
    if ($p.Thumbnail) {
      try {
        $st = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        # o PowerShell não converte o stream para o construtor; o Activator converte. O tamanho não vem: lê até 4 MB.
        $r = [Activator]::CreateInstance([Windows.Storage.Streams.DataReader], @($st))
        $n = Await ($r.LoadAsync([uint32]4194304)) ([uint32])
        $bytes = New-Object byte[] $n
        $r.ReadBytes($bytes)
        $type = if ($n -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8) { 'image/jpeg' } else { 'image/png' }
        if ($n -gt 0) { $script:thumbCache.data = "data:$type;base64," + [Convert]::ToBase64String($bytes) }
        $r.Dispose(); $st.Dispose()
      } catch {}
    }
  }
  $c = $info.Controls
  $o = [ordered]@{
    app = [string]$s.SourceAppUserModelId
    title = [string]$p.Title
    artist = [string]$p.Artist
    album = [string]$p.AlbumTitle
    status = ([string]$info.PlaybackStatus).ToLower()  # playing | paused | stopped | changing | opened | closed
    position = $tl.Position.TotalSeconds
    duration = ($tl.EndTime - $tl.StartTime).TotalSeconds
    updatedAt = $tl.LastUpdatedTime.ToUnixTimeMilliseconds()
    canPrev = [bool]$c.IsPreviousEnabled
    canNext = [bool]$c.IsNextEnabled
    canPlayPause = [bool]($c.IsPlayPauseToggleEnabled -or $c.IsPlayEnabled -or $c.IsPauseEnabled)
    thumbKey = $key
    thumb = $(if ($knownThumb -ne $key) { $script:thumbCache.data } else { $null })
  }
  return ($o | ConvertTo-Json -Compress)
}

function MediaControl($action) {
  $s = (MediaManager).GetCurrentSession()
  if (-not $s) { return 'false' }
  $op = switch ($action) {
    'play_pause' { $s.TryTogglePlayPauseAsync() }
    'next' { $s.TrySkipNextAsync() }
    'previous' { $s.TrySkipPreviousAsync() }
    default { $null }
  }
  if (-not $op) { return 'false' }
  if (Await $op ([bool])) { 'true' } else { 'false' }
}

$stdin = New-Object System.IO.StreamReader ([Console]::OpenStandardInput()), $utf8
[Console]::Out.WriteLine('{"id":0,"ok":true,"data":"ready"}'); [Console]::Out.Flush()
while ($null -ne ($line = $stdin.ReadLine())) {
  if (-not $line.Trim()) { continue }
  try { $msg = $line | ConvertFrom-Json } catch { continue }
  try {
    switch ([string]$msg.cmd) {
      'own' { foreach ($p in $msg.pids) { [AlmaWin]::AddOwnPid([uint32]$p) }; Emit $msg.id $true 'true' }
      'list' { Emit $msg.id $true ([AlmaWin]::List()) }
      'focus' { Emit $msg.id $true ('"' + [AlmaWin]::Focus([int64]$msg.hwnd) + '"') }
      'close' { [AlmaWin]::Close([int64]$msg.hwnd); Emit $msg.id $true 'true' }
      'start' { [AlmaWin]::StartMenu(); Emit $msg.id $true 'true' }
      'appinfo' { Emit $msg.id $true ((AppInfo ([string]$msg.aumid) ([string]$msg.exe)) | ConvertTo-Json -Compress) }
      'fullscreen' { Emit $msg.id $true ([AlmaWin]::Fullscreen()) }
      'volume' {
        if ($null -ne $msg.level) { [AlmaAudio]::Set([int]$msg.level) }
        if ($null -ne $msg.muted) { [AlmaAudio]::Mute([bool]$msg.muted) }
        Emit $msg.id $true ([AlmaAudio]::Get())
      }
      'mousedown' { Emit $msg.id $true $(if ([AlmaWin]::MouseDown()) { 'true' } else { 'false' }) }
      'nowplaying' { Emit $msg.id $true (NowPlaying ([string]$msg.thumbKey)) }
      'mediactl' { Emit $msg.id $true (MediaControl ([string]$msg.action)) }
      'quit' { exit 0 }
    }
  } catch {
    $e = $_.Exception; while ($e.InnerException) { $e = $e.InnerException }
    Emit $msg.id $false $null $e.Message
  }
}
