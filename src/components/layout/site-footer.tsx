import { SiteLink } from "@/components/navigation/site-link";
import { SocialIconLink } from "@/components/site/social-icon-link";
import { siteConfig } from "@/lib/config/site";
import { footerSocialLinks } from "@/lib/config/social-links";

const footerInfoGroups = [
  [
    ["상호명", siteConfig.businessName],
    ["대표자 · 개인정보보호책임자", siteConfig.privacyOfficer],
    ["사업장 주소", "12772 1층 경기도 광주시 수레실길 25-10 (능평동)"],
    ["사업자 등록번호", "129-37-99678"],
    ["통신판매업 신고번호", ""],
  ],
  [["연락처", `${siteConfig.email} · ${siteConfig.phone}`]],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-logo">{siteConfig.name}</div>
            <div className="footer-social-links" aria-label="외부 연결">
              {footerSocialLinks.map((link) => (
                <SocialIconLink
                  key={link.key}
                  link={link}
                  variant="footer"
                />
              ))}
            </div>
          </div>
          <div className="footer-info" aria-label="공방 정보">
            {footerInfoGroups.map((items, index) => (
              <div className="footer-info-group" key={`footer-info-${index}`}>
                <dl className="footer-info-list">
                  {items.map(([label, value]) => (
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
            <SiteLink href="/shipping-returns">배송·교환·환불정책</SiteLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
