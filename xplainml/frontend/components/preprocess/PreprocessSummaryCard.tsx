import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { PreprocessSummary } from "@/types";

export function PreprocessSummaryCard({ summary }: { summary: PreprocessSummary }) {
  return (
    <Card className="border-green-400/30 bg-green-400/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-400">
          <CheckCircle2 className="w-5 h-5" />
          Preprocessing Complete
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Rows after clean" value={summary.rows_after_cleaning} />
          <Stat label="Rows dropped" value={summary.rows_dropped} warn={summary.rows_dropped > 0} />
          <Stat label="Train samples" value={summary.train_size} />
          <Stat label="Test samples" value={summary.test_size} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stat label="Total features" value={summary.total_features} />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">SMOTE applied:</span>
            <Badge variant={summary.smote_applied ? "default" : "secondary"}>
              {summary.smote_applied ? "Yes" : "No"}
            </Badge>
          </div>
        </div>

        {/* Class distribution */}
        <div>
          <p className="text-sm font-medium mb-2">Class Distribution (Train)</p>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(summary.class_distribution_after).map(([cls, count]) => (
              <div key={cls} className="text-xs bg-accent rounded px-2 py-1">
                <span className="text-muted-foreground">Class {cls}: </span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${warn && value > 0 ? "text-orange-400" : "text-foreground"}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}