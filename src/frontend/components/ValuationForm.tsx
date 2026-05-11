            {result.recentTransactions.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold tracking-wide text-slate-500">
                      COMPARABLE SALES
                    </p>

                    <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      비교 거래 내역
                    </h3>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    최근 거래 우선
                  </span>
                </div>

                <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">거래일</th>
                        <th className="px-4 py-3 font-semibold">거래금액</th>
                        <th className="px-4 py-3 font-semibold">전용면적</th>
                        <th className="px-4 py-3 font-semibold">층</th>
                        <th className="px-4 py-3 font-semibold">비교군</th>
                        <th className="px-4 py-3 font-semibold">유사도</th>
                        <th className="px-4 py-3 font-semibold">선정 기준</th>
                        <th className="px-4 py-3 font-semibold">신뢰도</th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.recentTransactions.map((tx, index) => (
                        <tr
                          key={`${tx.dealYear}-${tx.dealMonth}-${tx.dealDay}-${tx.dealAmount}-${index}`}
                          className={
                            index === 0
                              ? "border-b bg-green-50 hover:bg-green-100"
                              : "border-b hover:bg-slate-50"
                          }
                        >
                          <td className="px-4 py-3 text-slate-700">
                            {tx.dealYear}.
                            {String(tx.dealMonth).padStart(2, "0")}.
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
                            <div className="flex flex-wrap gap-1">
                              {tx.isSameApartment && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                  동일단지
                                </span>
                              )}

                              {(tx.monthsAgo ?? 999) <= 3 && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                  최근거래
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {tx.similarityScore ?? "-"}점
                            {tx.similarityReason
                              ? ` · ${tx.similarityReason}`
                              : ""}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {tx.selectionReason ?? "-"}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            <span
                              className={
                                tx.reliabilityGrade === "A"
                                  ? "rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700"
                                  : tx.reliabilityGrade === "B"
                                    ? "rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700"
                                    : "rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"
                              }
                            >
                              {tx.reliabilityGrade ?? "-"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
                <div className="mb-3">
                  <p className="text-xs font-semibold tracking-wide text-amber-700">
                    WARNINGS
                  </p>

                  <h3 className="mt-1 text-xl font-bold tracking-tight text-amber-900">
                    주의사항
                  </h3>
                </div>

                <ul className="space-y-2 text-sm text-amber-900">
                  {result.warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <ValuationReport
            input={{
              addressRaw,
              buildingName,
              exclusiveAreaM2,
              managerName,
              rightsRisk: initialValue.rightsRisk
            }}
            result={result}
          />
        </>
      )}
    </section>
  );
}
