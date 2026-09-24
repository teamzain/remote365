; Remote 365 NSIS lifecycle hooks.
; Keep this file outside build/: build/ is gitignored and release behavior must
; not depend on an untracked local file.

!macro customHeader
  !ifndef MUI_WELCOMEPAGE_TITLE
    !define MUI_WELCOMEPAGE_TITLE "Welcome to Remote 365"
  !endif
  !ifndef MUI_WELCOMEPAGE_TEXT
    !define MUI_WELCOMEPAGE_TEXT "Remote 365 gives you secure remote access and support for all of your devices.$\r$\n$\r$\nClick Next to continue."
  !endif
  !ifndef MUI_FINISHPAGE_TITLE
    !define MUI_FINISHPAGE_TITLE "Remote 365 is ready"
  !endif
  !ifndef MUI_FINISHPAGE_TEXT
    !define MUI_FINISHPAGE_TEXT "Setup is complete. Launch Remote 365 to connect to your devices from anywhere."
  !endif
!macroend

; Release every executable that can originate from the application directory.
; electron-builder calls customInit BEFORE it runs the previous uninstaller,
; which is the only useful point for preventing NSIS error 2
; ("Failed to uninstall old application files").
;
; Every nsExec call pushes its exit code. Always pop it: leaving plugin results
; on the NSIS stack can corrupt later installer/uninstaller macro calls.
!macro stopRemote365InstallProcesses
  Push $0

  DetailPrint "Closing previous Remote365 processes..."
  nsExec::ExecToLog 'taskkill /F /IM "Remote 365.exe" /T'
  Pop $0

  ; Older releases could run the LocalSystem input service directly from
  ; $INSTDIR\resources. Stop it before the old uninstaller tries to atomically
  ; move that directory. Current releases run the service from ProgramData, so
  ; these commands are harmless when no legacy lock exists.
  nsExec::ExecToLog 'sc.exe stop Remote365InputSvc'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM Remote365InputSvc.exe /T'
  Pop $0

  ; Kill only FFmpeg instances belonging to this application. Do not terminate
  ; unrelated FFmpeg jobs that the user may be running.
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process ffmpeg -ErrorAction SilentlyContinue | Where-Object Path -like $\'$INSTDIR\*$\' | Stop-Process -Force -ErrorAction SilentlyContinue"'
  Pop $0
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process ffmpeg -ErrorAction SilentlyContinue | Where-Object Path -like $\'$LOCALAPPDATA\Programs\remote-365\*$\' | Stop-Process -Force -ErrorAction SilentlyContinue"'
  Pop $0

  ; Service/process termination is asynchronous on slower machines. Give file
  ; handles time to close, then make one bounded second pass before uninstall.
  Sleep 1500
  nsExec::ExecToLog 'taskkill /F /IM "Remote 365.exe" /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM Remote365InputSvc.exe /T'
  Pop $0
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process ffmpeg -ErrorAction SilentlyContinue | Where-Object Path -like $\'$INSTDIR\*$\' | Stop-Process -Force -ErrorAction SilentlyContinue"'
  Pop $0
  Sleep 500

  Pop $0
!macroend

!macro customInit
  !insertmacro stopRemote365InstallProcesses
!macroend

; ---------------------------------------------------------------------------
; NEVER let a failed old-version uninstall kill a silent auto-update.
;
; electron-builder's stock handleUninstallResult (installUtil.nsh) reacts to a
; non-zero old-uninstaller exit code with a MessageBox that has NO /SD flag —
; it pops up even during a fully silent background update — and then Quits the
; installer. By that point electron-updater has already quit the app, so an
; unattended machine is left OFFLINE behind a dialog nobody clicks. That is the
; fleet incident: "Failed to uninstall old application files ... : 2".
;
; Exit code 2 means the old uninstaller ABORTED: its atomic-rename step found
; at least one locked file in $INSTDIR, rolled every rename back, and gave up.
; Lockers a NON-elevated per-user updater can never clear include a legacy
; Remote365InputSvc/agent registered from $INSTDIR\resources (SYSTEM-owned and
; respawned by the service supervisor) and transient AV/indexer scans. Because
; of the rollback the old install is still fully intact, so the right move is
; to CONTINUE: NSIS extraction overwrites the app in place, and its silent
; fallback (Nsis7z::Extract) skips the odd still-locked file instead of dying.
; A stale leftover file is a cosmetic issue; a dead host is not.
;
; Defining customUnInstallCheck/-CurrentUser makes handleUninstallResult call
; US and return, replacing the stock modal+Quit entirely.
; ---------------------------------------------------------------------------
!macro remote365TolerateUninstallResult
  ${If} ${Errors}
    ClearErrors
    DetailPrint "Old uninstaller could not be launched; continuing update in place."
  ${ElseIf} $R0 != 0
    DetailPrint "Old-version uninstall failed (code $R0). Continuing update in place over the existing files."
    ; One more sweep so extraction meets as few locked files as possible.
    !insertmacro stopRemote365InstallProcesses
  ${EndIf}
  ClearErrors
!macroend

!macro customUnInstallCheck
  !insertmacro remote365TolerateUninstallResult
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro remote365TolerateUninstallResult
!macroend

; A direct uninstall enters the old uninstaller before its file-removal section.
; Release the same locks here as well.
!macro customUnInit
  !insertmacro stopRemote365InstallProcesses
!macroend

; ---------------------------------------------------------------------------
; Make FUTURE uninstallers incapable of the exit-code-2 abort.
;
; The stock un.install section moves every file in $INSTDIR aside via
; un.atomicRMDir and calls Abort (exit code 2) if a single file is locked —
; that exact abort, baked into already-shipped uninstallers, is what today's
; fleet hits during updates. customUnInstallCheck above shields the installer
; from those old uninstallers; this macro fixes the uninstaller we ship from
; now on: same atomic move, but on failure it restores the files and RETURNS
; SUCCESS instead of aborting, so the surrounding update simply overwrites in
; place. un.atomicRMDir / un.restoreFiles are always compiled into the
; uninstaller (see app-builder-lib templates/nsis/uninstaller.nsh); if a
; future electron-builder upgrade renames them, makensis fails loudly at
; BUILD time — never silently on a customer machine.
; ---------------------------------------------------------------------------
!macro customRemoveFiles
  ${If} ${isUpdated}
    CreateDirectory "$PLUGINSDIR\old-install"

    Push ""
    Call un.atomicRMDir
    Pop $R0

    ${If} $R0 != 0
      DetailPrint "File is busy ($R0); restoring files and letting the update overwrite in place."
      Push ""
      Call un.restoreFiles
      Pop $R0
      ; No Abort: exit 0 so the waiting installer proceeds instead of retrying
      ; five times and dying on a modal error dialog.
    ${Else}
      RMDir /r $INSTDIR
    ${EndIf}
  ${Else}
    RMDir /r $INSTDIR
  ${EndIf}
!macroend

!macro customUnInstall
  ; Updating runs the old uninstaller with --updated. Never delete the external
  ; ProgramData service during an update; doing so made secure input disappear
  ; after every release. Remove it only for a real product uninstall.
  ${IfNot} ${isUpdated}
    Push $0
    DetailPrint "Removing Remote365 Input Service..."
    nsExec::ExecToLog 'sc.exe stop Remote365InputSvc'
    Pop $0
    nsExec::ExecToLog 'taskkill /F /IM Remote365InputSvc.exe /T'
    Pop $0
    Sleep 500
    nsExec::ExecToLog '"C:\ProgramData\Remote365\Remote365InputSvc.exe" --uninstall'
    Pop $0
    nsExec::ExecToLog 'sc.exe delete Remote365InputSvc'
    Pop $0
    Pop $0
  ${EndIf}
!macroend
