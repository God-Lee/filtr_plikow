export function joinWindowsPath(folderPath: string, fileName: string) {
  return `${folderPath.replace(/[\\/]+$/, "")}\\${fileName}`;
}

export function normalizeFileSystemPath(filePath: string) {
  return filePath.trim().replace(/\//g, "\\").replace(/\\+/g, "\\").toLocaleLowerCase("pl");
}

export function normalizeFileSystemPathList(filePaths: string[]) {
  return Array.from(
    new Set(
      filePaths
        .filter((filePath) => filePath.trim().length > 0)
        .map((filePath) => normalizeFileSystemPath(filePath)),
    ),
  );
}
