import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnInfo } from "@/types";

export function DataPreview({
  preview,
  columns,
}: {
  preview: Record<string, string>[];
  columns: ColumnInfo[];
}) {
  if (!preview || preview.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data Preview (first 10 rows)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {columns.map((col) => (
                  <th key={col.name} className="text-left py-2 pr-4 whitespace-nowrap font-mono">
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-accent/20">
                  {columns.map((col) => (
                    <td key={col.name} className="py-1.5 pr-4 whitespace-nowrap text-muted-foreground">
                      {row[col.name] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}