interface IpynbCell {
  source: string | string[];
}

export function parseIpynb(content: string): string {
  const notebook = JSON.parse(content) as { cells?: IpynbCell[] };
  return (notebook.cells ?? [])
    .map((cell) =>
      Array.isArray(cell.source) ? cell.source.join("") : cell.source
    )
    .filter(Boolean)
    .join("\n\n");
}
