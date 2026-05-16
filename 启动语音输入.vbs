' 语音输入服务器启动器
' 双击此文件即可启动语音输入服务

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' 获取当前脚本所在目录
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' 在新窗口中启动 node server.js
objShell.Run "cmd /c cd /d """ & strPath & """ && node server.js && pause", 1, True
