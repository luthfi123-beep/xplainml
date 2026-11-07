import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnInfo } from "@/types";

export function ColumnSummary({ columns }: { columns: ColumnInfo[] }) {
  const numerical = columns.filter((c) => c.type === "numerical");
  const categorical = columns.filter((c) => c.type === "categorical");
  const withMissing = columns.filter((c) => c.missing > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-blue-400">{numerical.length}</p>
            <p className="text-sm text-muted-foreground">Numerical columns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-purple-400">{categorical.length}</p>
            <p className="text-sm text-muted-foreground">Categorical columns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-orange-400">{withMissing.length}</p>
            <p className="text-sm text-muted-foreground">Columns with missing</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Column Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 pr-4">Column</th>
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-left py-2 pr-4">Dtype</th>
                  <th className="text-left py-2 pr-4">Missing</th>
                  <th className="text-left py-2 pr-4">Unique</th>
                  <th className="text-left py-2">Sample Values</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col.name} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-2 pr-4 font-mono font-medium">{col.name}</td>
                    <td className="py-2 pr-4">
                      <Badge
                        variant="outline"
                        className={
                          col.type === "numerical"
                            ? "border-blue-400/50 text-blue-400"
                            : col.type === "categorical"
                            ? "border-purple-400/50 text-purple-400"
                            : "border-border"
                        }
                      >
                        {col.type}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground font-mono text-xs">{col.dtype}</td>
                    <td className="py-2 pr-4">
                      {col.missing > 0 ? (
                        <span className="text-orange-400">
                          {col.missing} ({col.missing_pct}%)
                        </span>
                      ) : (
                        <span className="text-green-400">None</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{col.unique}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {col.sample_values.slice(0, 3).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}