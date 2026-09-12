import type { ReportModel } from "./reportModel";

interface PrintableReportProps {
  model: ReportModel;
}

/**
 * On-screen / print rendering of the house-format report. The report's content
 * and structure come entirely from {@link ReportModel}; this component only
 * decides how it looks. Hidden on screen and revealed by the `@media print`
 * rules in index.css, so `window.print()` drives paper printing.
 */
export default function PrintableReport({ model }: PrintableReportProps) {
  return (
    <div
      className={`print-report${model.isFinalized ? "" : " pr-draft"}`}
    >
      <header className="pr-letterhead">
        <div className="pr-brand">
          {model.brand.logoDataUrl && <img className="pr-logo" src={model.brand.logoDataUrl} alt="Laboratory logo" />}
          <h1>{model.brand.name}</h1>
          <p className="pr-tagline">{model.brand.tagline}</p>
          <p className="pr-accred">{model.brand.strapline}</p>
          {model.brand.contact && <p className="pr-contact">{model.brand.contact}</p>}
        </div>

        <div className="pr-docmeta">
          <p className="pr-doctitle">{model.documentTitle}</p>
          <dl>
            <div>
              <dt>Report No.</dt>
              <dd>{model.reportNo}</dd>
            </div>
            {!model.isFinalized && <div><dt>Status</dt><dd>Draft</dd></div>}
          </dl>
        </div>
      </header>

      {model.draftNotice && (
        <p className="pr-draftbanner">{model.draftNotice}</p>
      )}
      {model.amendmentNotice && (
        <p className="pr-amendmentbanner">{model.amendmentNotice}</p>
      )}

      <section className="pr-band" aria-label="Patient and specimen details">
        {model.band.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </section>

      {model.resultGroups.length > 0 && (
        <section className="pr-section">
          <h2>{model.resultsHeading}</h2>

          {model.resultGroups.map((group) => (
            <div key={group.key} className="pr-results-group">
              {model.showGroupHeadings && group.testName && (
                <h3 className="pr-results-heading">{group.testName}</h3>
              )}

              <table className="pr-results">
                <colgroup>
                  <col className="pr-col-param" />
                  <col className="pr-col-result" />
                  <col className="pr-col-unit" />
                  <col className="pr-col-ref" />
                  <col className="pr-col-flag" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Result</th>
                    <th>Unit</th>
                    <th>Reference Range</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.name}</td>
                      <td className={row.numeric ? "pr-num pr-value" : "pr-value"}>
                        {row.value}
                      </td>
                      <td>{row.unit}</td>
                      <td>{row.reference}</td>
                      <td className="pr-flag-cell">
                        {row.flag ? (
                          <span
                            className={`pr-flag pr-flag-${row.flag}`}
                            title={row.flagLabel}
                          >
                            {row.flag}
                          </span>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {model.narratives.map((narrative) => (
        <section
          key={narrative.heading}
          className={`pr-section${narrative.emphasis ? " pr-diagnosis" : ""}`}
        >
          <h2>{narrative.heading}</h2>
          <p className="pr-narrative">{narrative.body}</p>
        </section>
      ))}

      <section className="pr-signoff">
        {model.signoff.map((entry) => (
          <div key={entry.role} className="pr-sig">
            <div className="pr-sigline" />
            <p className="pr-sigrole">{entry.role}</p>
            <p className="pr-signote">{entry.note}</p>
          </div>
        ))}
      </section>

      <p className="pr-authnote">{model.authorisationNote}</p>

      <p className="pr-endmark">{model.endOfReport}</p>

      <footer className="pr-footer">
        <span>{model.footer.reference}</span>
        <span className="pr-disclaimer">{model.footer.disclaimer}</span>
        <span>Report date {model.generatedAt}</span>
      </footer>
    </div>
  );
}
