import { loadExportRound } from "@/lib/export/route-guard";
import { buildRmaSchoolSummary } from "@/lib/export/rma-xlsx";
import { XLSX_CONTENT_TYPE } from "@/lib/export/xlsx-template";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const result = await loadExportRound("rma", roundId);
  if (!result.ok) return result.response;

  const buffer = await buildRmaSchoolSummary(result.supabase, result.round.id);

  return new Response(buffer, {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="RMA_School_Summary_${result.round.name}.xlsx"`,
    },
  });
}
