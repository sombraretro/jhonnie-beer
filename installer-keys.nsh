; Nenhuma chave individual fica em texto claro no instalador.
; O instalador verifica somente o formato. A lista exata das 50 chaves
; e validada pelo aplicativo Electron na primeira execucao, usando hashes SHA-256.
Function UniPDVCheckInstallKey
  StrCpy $LicenseKeyValid "0"
  StrLen $0 $LicenseKey
  ${If} $0 != 25
    Return
  ${EndIf}
  StrCpy $0 $LicenseKey 6 0
  ${If} $0 != "UNI32-"
    Return
  ${EndIf}
  StrCpy $0 $LicenseKey 1 10
  ${If} $0 != "-"
    Return
  ${EndIf}
  StrCpy $0 $LicenseKey 1 15
  ${If} $0 != "-"
    Return
  ${EndIf}
  StrCpy $0 $LicenseKey 1 20
  ${If} $0 != "-"
    Return
  ${EndIf}
  StrCpy $LicenseKeyValid "1"
FunctionEnd
