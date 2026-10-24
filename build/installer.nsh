; Instalador da Alma (NSIS, via electron-builder).

; Ao desinstalar (não numa atualização), pergunta se apaga também os dados: tarefas, aparência, bandeja e contas do ar.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION "Apagar também os seus dados da Alma (tarefas, aparência, bandeja e contas do ar-condicionado)?$\r$\n$\r$\nEscolha Não para mantê-los, caso instale a Alma de novo." /SD IDNO IDNO alma_keep
      RMDir /r "$APPDATA\Alma"
    alma_keep:
  ${endIf}
!macroend
