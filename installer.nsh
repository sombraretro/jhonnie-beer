!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; A instalacao pede apenas UMA chave UNI32 ao tecnico.
; Nenhum emissor externo ou arquivo .updlicense e necessario.
!ifndef BUILD_UNINSTALLER

Var LicenseDialog
Var LicenseKeyInput
Var LicenseStatus
Var LicenseKey
Var LicenseKeyValid
Var LicenseIsActivated

!include "installer-keys.nsh"

Function UniPDVLicenseReadExisting
  StrCpy $LicenseKey ""
  StrCpy $LicenseIsActivated "0"
  ; Reinstalacoes/atualizacoes no mesmo usuario mantem a ativacao existente.
  IfFileExists "$APPDATA\PDV-Loja-Licenciado\activation.local" 0 check_pending
    StrCpy $LicenseIsActivated "1"
    Return
  check_pending:
  IfFileExists "$APPDATA\PDV-Loja-Licenciado\install.key" 0 done_read
  ClearErrors
  FileOpen $0 "$APPDATA\PDV-Loja-Licenciado\install.key" r
  ${IfNot} ${Errors}
    FileRead $0 $LicenseKey
    FileClose $0
  ${EndIf}
  done_read:
FunctionEnd

Function UniPDVLicenseUpdateUi
  ${NSD_GetText} $LicenseKeyInput $LicenseKey
  Call UniPDVCheckInstallKey
  GetDlgItem $0 $HWNDPARENT 1
  ${If} $LicenseKeyValid == "1"
    ${NSD_SetText} $LicenseStatus "Formato aceito. A chave sera confirmada ao abrir o Uni-PDV."
    SetCtlColors $LicenseStatus 0x2E9D68 transparent
    EnableWindow $0 1
  ${Else}
    ${If} $LicenseKey == ""
      ${NSD_SetText} $LicenseStatus "Informe uma chave UNI32 para instalar."
    ${Else}
      ${NSD_SetText} $LicenseStatus "Formato incorreto. Confira o codigo UNI32 informado."
    ${EndIf}
    SetCtlColors $LicenseStatus 0xC34A4A transparent
    EnableWindow $0 0
  ${EndIf}
FunctionEnd

Function UniPDVLicensePageCreate
  Call UniPDVLicenseReadExisting
  ${If} $LicenseIsActivated == "1"
    Abort
  ${EndIf}
  Call UniPDVCheckInstallKey
  ${If} $LicenseKeyValid == "1"
    Abort
  ${EndIf}
  nsDialogs::Create 1018
  Pop $LicenseDialog
  ${If} $LicenseDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 25u "Chave de instalacao Uni-PDV Licenciado"
  Pop $0
  CreateFont $1 "$(^Font)" "12" "700"
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateLabel} 0 32u 100% 36u "O responsavel pela instalacao digita uma chave do arquivo privado de 50 chaves. Nenhum login, internet ou Kit Admin e necessario."
  Pop $0
  ${NSD_CreateText} 0 70u 100% 16u ""
  Pop $LicenseKeyInput
  SendMessage $LicenseKeyInput ${EM_SETLIMITTEXT} 25 0
  ${NSD_OnChange} $LicenseKeyInput UniPDVLicenseUpdateUi
  ${NSD_CreateLabel} 0 96u 100% 27u "Informe uma chave UNI32 para instalar."
  Pop $LicenseStatus
  SetCtlColors $LicenseStatus 0xC34A4A transparent
  ${NSD_CreateLabel} 0 132u 100% 38u "Formato: UNI32-XXXX-XXXX-XXXX-XXXX. A ativacao do software sera realizada automaticamente na primeira abertura deste Windows."
  Pop $0
  GetDlgItem $0 $HWNDPARENT 1
  EnableWindow $0 0
  nsDialogs::Show
FunctionEnd

Function UniPDVLicensePageLeave
  ${NSD_GetText} $LicenseKeyInput $LicenseKey
  Call UniPDVCheckInstallKey
  ${If} $LicenseKeyValid != "1"
    MessageBox MB_ICONSTOP|MB_OK "O formato da chave UNI32 nao e valido."
    Abort
  ${EndIf}
FunctionEnd

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
  Page custom UniPDVLicensePageCreate UniPDVLicensePageLeave
!macroend

!macro customInstall
  ; Nao guarda chaves de instalacao em texto claro no Registro.
  DeleteRegValue HKCU "Software\Uni Softwares\Uni-PDV Licenciado" "InstallKey"
  ${If} $LicenseIsActivated != "1"
    ${If} $LicenseKey == ""
      Call UniPDVLicenseReadExisting
    ${EndIf}
    Call UniPDVCheckInstallKey
    ${If} $LicenseKeyValid == "1"
      CreateDirectory "$APPDATA\PDV-Loja-Licenciado"
      FileOpen $0 "$APPDATA\PDV-Loja-Licenciado\install.key" w
      FileWrite $0 "$LicenseKey"
      FileClose $0
    ${EndIf}
  ${EndIf}
!macroend

!endif ; BUILD_UNINSTALLER
