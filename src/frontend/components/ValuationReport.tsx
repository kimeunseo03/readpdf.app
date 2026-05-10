<div className="mt-8 grid gap-4 md:grid-cols-4">
  <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4">
    <p className="text-xs font-semibold text-green-700">
      보정 평균가
    </p>

    <p className="mt-3 whitespace-pre-line text-lg font-bold leading-snug tracking-tight tabular-nums text-green-700">
      {formatKoreanPrice(result.averagePrice)}
    </p>
  </div>

  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
    <p className="text-xs font-semibold text-blue-700">
      최저 거래가
    </p>

    <p className="mt-3 whitespace-pre-line text-lg font-bold leading-snug tracking-tight tabular-nums text-blue-700">
      {formatKoreanPrice(result.lowestPrice)}
    </p>
  </div>

  <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
    <p className="text-xs font-semibold text-orange-700">
      최고 거래가
    </p>

    <p className="mt-3 whitespace-pre-line text-lg font-bold leading-snug tracking-tight tabular-nums text-orange-700">
      {formatKoreanPrice(result.highestPrice)}
    </p>
  </div>

  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-semibold text-slate-600">
      평가 신뢰도
    </p>

    <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-slate-900">
      {result.overallConfidence ?? "-"}
    </p>

    <p className="mt-2 text-xs text-slate-500">
      비교 거래 {result.comparableCount}건
    </p>
  </div>
</div>

<div className="mt-8">
  <div className="mb-3">
    <p className="text-xs font-semibold tracking-wide text-slate-500">
      COMPARABLE SALES
    </p>

    <h3 className="mt-1 text-lg font-bold text-slate-900">
      비교 거래 내역
    </h3>
  </div>

  <div className="overflow-hidden rounded-2xl border border-slate-200">
    <table className="w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3 font-semibold">거래일</th>
          <th className="px-4 py-3 font-semibold">금액</th>
          <th className="px-4 py-3 font-semibold">면적</th>
          <th className="px-4 py-3 font-semibold">층</th>
          <th className="px-4 py-3 font-semibold">유사도</th>
          <th className="px-4 py-3 font-semibold">신뢰도</th>
        </tr>
      </thead>

      <tbody>
        {result.recentTransactions.map((tx, index) => (
          <tr
            key={`${tx.dealYear}-${tx.dealMonth}-${tx.dealDay}-${tx.dealAmount}-${index}`}
            className={
              index === 0
                ? "border-b bg-green-50"
                : "border-b"
            }
          >
            <td className="px-4 py-3 text-slate-700">
              {tx.dealYear}.{String(tx.dealMonth).padStart(2, "0")}.
              {String(tx.dealDay).padStart(2, "0")}

              {index === 0 && (
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  최우선 비교군
                </span>
              )}
            </td>

            <td className="whitespace-pre-line px-4 py-3 font-medium tabular-nums text-slate-700">
              {formatKoreanPrice(tx.dealAmount)}
            </td>

            <td className="px-4 py-3 text-slate-700">
              {tx.area}㎡
            </td>

            <td className="px-4 py-3 text-slate-700">
              {tx.floor ?? "-"}층
            </td>

            <td className="px-4 py-3 text-slate-700">
              {tx.similarityScore ?? "-"}점
              {tx.similarityReason
                ? ` · ${tx.similarityReason}`
                : ""}
            </td>

            <td className="px-4 py-3 text-slate-700">
              <span className={reliabilityBadgeClass(tx.reliabilityGrade)}>
                {tx.reliabilityGrade ?? "-"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
