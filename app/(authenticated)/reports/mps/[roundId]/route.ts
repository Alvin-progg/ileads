import { loadExportRound } from "@/lib/export/route-guard";
import { buildMpsWorkbook } from "@/lib/export/mps-xlsx";
import { XLSX_CONTENT_TYPE } from "@/lib/export/xlsx-template";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const result = await loadExportRound("exam", roundId);
  if (!result.ok) return result.response;

  const buffer = await buildMpsWorkbook(result.supabase, result.round.id, result.round.name);

  return new Response(buffer, {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="MPS_${result.round.name}.xlsx"`,
    },
  });
}
