// Use the system installation, never an executable selected by the caller's PATH.
export const gitExecutable = process.platform === 'win32'
  ? String.raw`C:\Program Files\Git\cmd\git.exe`
  : '/usr/bin/git';
