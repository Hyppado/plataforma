import { readFileSync, writeFileSync } from "fs";

let c = readFileSync("app/dashboard/products/page.tsx", "utf8");

c = c.replace(
  'import { normalizeRange, type TimeRange } from "@/lib/filters/timeRange";\n',
  ""
);
c = c.replace(
  '  const timeRange = normalizeRange(searchParams.get("range"));\n',
  ""
);
c = c.replace("      range: timeRange,\n", "");
c = c.replace(
  '          timeRange={timeRange}\n          onTimeRangeChange={handleTimeRangeChange}\n          onRefresh={() => mutate()}',
  "          onRefresh={() => mutate()}"
);
// Fix all router.push pointing to /dashboard/trends
c = c.replace(/\/dashboard\/trends\?/g, "/dashboard/products?");
// Remove handleTimeRangeChange function block
c = c.replace(
  /\n  const handleTimeRangeChange[\s\S]*?router\.push[^\n]+\n  \};\n/,
  "\n"
);

writeFileSync("app/dashboard/products/page.tsx", c);

const leftTR = (c.match(/timeRange/g) || []).length;
const leftTrends = (c.match(/dashboard\/trends/g) || []).length;
console.log(`timeRange refs left: ${leftTR}, /dashboard/trends refs left: ${leftTrends}`);
