import type { ChangelogRelease } from '../../../shared/changelog'
import { releaseDate, releaseName } from './news'
import { RichText } from './RichText'
import './help.css'

// One or more entries of CHANGELOG.md, nicely: the date on top, then what changed.
export function Releases({ releases }: { releases: ChangelogRelease[] }): React.JSX.Element {
  return (
    <div className="help-releases">
      {releases.map((r) => (
        <article key={`${r.version}-${r.date}`} className="help-release">
          {r.date && (
            <time className="help-release-date" dateTime={r.date}>
              {releaseDate(r.date)}
            </time>
          )}
          <h3>{releaseName(r.version)}</h3>
          {r.groups.map((g) => (
            <div key={g.title} className="help-release-group">
              <h4>{g.title}</h4>
              <ul>
                {g.items.map((item, i) => (
                  <li key={i}>
                    <RichText text={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </article>
      ))}
    </div>
  )
}
