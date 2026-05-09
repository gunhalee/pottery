import { SiteLink } from "@/components/navigation/site-link";
import { siteConfig } from "@/lib/config/site";

const footerSocialLinks = [
  {
    href: siteConfig.instagramUrl,
    icon: <InstagramIcon />,
    label: "Instagram",
  },
  {
    href: siteConfig.kakaoChannelUrl,
    icon: <KakaoIcon />,
    label: "카카오채널",
  },
  {
    href: null,
    icon: <YouTubeIcon />,
    label: "YouTube",
  },
  {
    href: null,
    icon: <BlogIcon />,
    label: "Blog",
  },
];

const footerInfoGroups = [
  {
    title: "사업자 정보",
    items: [
      ["상호명", "크룬프로젝트"],
      ["대표자 · 개인정보보호책임자", "하지영"],
      ["사업장 주소", "12772 1층 경기도 광주시 수레실길 25-10 (능평동)"],
      ["사업자 등록번호", "129-37-99678"],
      ["통신판매업 신고번호", ""],
    ],
  },
  {
    title: "문의",
    items: [["연락처", "designhada2001@gmail.com · 0507-0177-5929"]],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-logo">{siteConfig.name}</div>
            <div className="footer-social-links" aria-label="외부 연결">
              {footerSocialLinks.map((link) =>
                link.href ? (
                  <a
                    aria-label={link.label}
                    className="footer-social-link"
                    href={link.href}
                    key={link.label}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {link.icon}
                  </a>
                ) : (
                  <span
                    aria-label={`${link.label} 링크 준비 중`}
                    className="footer-social-link footer-social-link-placeholder"
                    key={link.label}
                    role="img"
                  >
                    {link.icon}
                  </span>
                ),
              )}
            </div>
          </div>
          <div className="footer-info" aria-label="공방 정보">
            {footerInfoGroups.map((group) => (
              <div className="footer-info-group" key={group.title}>
                <p className="footer-info-group-title">{group.title}</p>
                <dl className="footer-info-list">
                  {group.items.map(([label, value]) => (
                    <div className="footer-info-item" key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "\u00a0"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">
            &copy; 2026 크룬프로젝트. All rights reserved.
          </div>
          <div className="footer-legal">
            <SiteLink href="/terms">이용약관</SiteLink>
            <SiteLink href="/privacy">개인정보처리방침</SiteLink>
          </div>
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect height="17" rx="5" width="17" x="3.5" y="3.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.8h.01" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M12 4.2c-4.7 0-8.4 2.9-8.4 6.5 0 2.3 1.5 4.3 3.8 5.5l-.8 3 3.4-2.1c.6.1 1.3.2 2 .2 4.7 0 8.4-2.9 8.4-6.6 0-3.6-3.7-6.5-8.4-6.5Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect height="13" rx="3" width="18" x="3" y="5.5" />
      <path d="m10.5 9 4.4 3-4.4 3V9Z" />
    </svg>
  );
}

function BlogIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M5 5h14v11H9l-4 3V5Z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  );
}
