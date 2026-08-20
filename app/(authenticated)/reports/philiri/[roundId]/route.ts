import { loadExportRound } from "@/lib/export/route-guard";
import { buildPhiliriSchoolSummary } from "@/lib/export/philiri-xlsx";
import { XLSX_CONTENT_TYPE } from "@/lib/export/xlsx-template";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const result = await loadExportRound("philiri", roundId);
  if (!result.ok) return result.response;

  const buffer = await buildPhiliriSchoolSummary(
    result.supabase,
    result.round.id,
    result.round.name
  );

  return new Response(buffer, {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="PhilIRI_School_Summary_${result.round.name}.xlsx"`,
    },
  });
}
