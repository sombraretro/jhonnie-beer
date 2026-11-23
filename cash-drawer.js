'use strict';
const { spawnSync } = require('node:child_process');

function buildPulse(pin = 2, pulseOnMs = 100, pulseOffMs = 100) {
  const p = Number(pin);
  if (![2, 5].includes(p)) throw new Error('A gaveta deve usar o pino 2 ou 5 da porta DK.');
  const on = Math.max(2, Math.min(510, Math.round(Number(pulseOnMs) / 2)));
  const off = Math.max(2, Math.min(510, Math.round(Number(pulseOffMs) / 2)));
  return Buffer.from([0x1b, 0x70, p === 2 ? 0 : 1, on, off]);
}

function openDrawer(options = {}) {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'O acionamento direto da gaveta está disponível nesta versão para Windows.' };
  }
  const printer = String(options.printer || '').trim();
  if (!printer) return { ok: false, error: 'Configure o nome da impressora Epson nas configurações de periféricos.' };
  let pulse;
  try { pulse = buildPulse(options.pin, options.pulseOnMs, options.pulseOffMs); }
  catch (error) { return { ok: false, error: error.message }; }
  const bytes = Array.from(pulse).join(',');
  const script = `param([string]$Printer,[string]$Bytes)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
 public class DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
 [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
 [DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr handle);
 [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)] public static extern int StartDocPrinter(IntPtr handle, int level, [In] DOCINFO info);
 [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr handle);
 [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr handle);
 [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr handle);
 [DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr handle, byte[] data, int count, out int written);
}
'@
$handle = [IntPtr]::Zero
if (-not [RawPrinter]::OpenPrinter($Printer,[ref]$handle,[IntPtr]::Zero)) { throw "Não foi possível abrir a fila da impressora '$Printer'. Código Win32: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
$doc = New-Object RawPrinter+DOCINFO
$doc.pDocName = 'Abertura da gaveta de dinheiro'
$doc.pDataType = 'RAW'
try {
 if ([RawPrinter]::StartDocPrinter($handle,1,$doc) -eq 0) { throw 'Não foi possível iniciar o trabalho RAW da impressora.' }
 if (-not [RawPrinter]::StartPagePrinter($handle)) { throw 'Não foi possível iniciar a página RAW.' }
 [byte[]]$data = $Bytes.Split(',') | ForEach-Object { [byte][int]$_ }
 [int]$written = 0
 if (-not [RawPrinter]::WritePrinter($handle,$data,$data.Length,[ref]$written) -or $written -ne $data.Length) { throw 'A impressora não confirmou o envio completo do pulso da gaveta.' }
 [void][RawPrinter]::EndPagePrinter($handle)
 [void][RawPrinter]::EndDocPrinter($handle)
 'OK'
} finally { [void][RawPrinter]::ClosePrinter($handle) }`;
  const result = spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script, printer, bytes], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  if (result.error) return { ok: false, error: result.error.message };
  if (result.status !== 0 || !String(result.stdout || '').includes('OK')) {
    return { ok: false, error: String(result.stderr || result.stdout || 'Falha ao enviar o comando RAW à impressora.').trim() };
  }
  return { ok: true, printer, pin: Number(options.pin || 2) };
}

module.exports = { buildPulse, openDrawer };
