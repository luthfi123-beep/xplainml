import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ReportRow {
  class: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

const isAggregateRow = (cls: string) =>
  ["macro avg", "weighted avg", "micro avg"].includes(cls);

export function ClassificationReport({ report }: { report: ReportRow[] }) {
  const classRows     = report.filter((r) => !isAggregateRow(r.class));
  const aggregateRows = report.filter((r) => isAggregateRow(r.class));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-3 pr-4">Class</th>
            <th className="text-right py-3 px-3">Precision</th>
            <th className="text-right py-3 px-3">Recall</th>
            <th className="text-right py-3 px-3">F1</th>
            <th className="text-right py-3 pl-3">Support</th>
          </tr>
        </thead>
        <tbody>
          {classRows.map((row) => (
            <tr key={row.class} className="border-b border-border/50 hover:bg-accent/30">
              <td className="py-2 pr-4">
                <Badge variant="outline" className="font-mono text-xs">
                  Class {row.class}
                </Badge>
              </td>
              <MetricCell value={row.precision} />
              <MetricCell value={row.recall} />
              <MetricCell value={row.f1} highlight />
              <td className="text-right py-2 pl-3 text-muted-foreground font-mono">
                {row.support}
              </td>
            </tr>
          ))}

          {/* Separator */}
          <tr><td colSpan={5} className="py-1" /></tr>

          {aggregateRows.map((row) => (
            <tr key={row.class} className="border-b border-border/30 bg-accent/10">
              <td className="py-2 pr-4 text-muted-foreground text-xs italic">
                {row.class}
              </td>
              <MetricCell value={row.precision} muted />
              <MetricCell value={row.recall} muted />
              <MetricCell value={row.f1} muted />
              <td className="text-right py-2 pl-3 text-muted-foreground font-mono text-xs">
                {row.support}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCell({
  value,
  highlight = false,
  muted = false,
}: {
  value: number;
  highlight?: boolean;
  muted?: boolean;
}) {
  const color =
    value >= 0.8
      ? "text-green-400"
      : value >= 0.6
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <td className={`text-right py-2 px-3 font-mono ${muted ? "text-muted-foreground text-xs" : color} ${highlight ? "font-bold" : ""}`}>
      {(value * 100).toFixed(1)}%
    </td>
  );
}