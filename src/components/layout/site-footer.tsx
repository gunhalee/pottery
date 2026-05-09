import { SiteLink } from "@/components/navigation/site-link";
import { siteConfig } from "@/lib/config/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div>
            <div className="footer-logo">{siteConfig.name}</div>
            <div className="footer-address">
              서울의 작은 도자 공방
              <br />
              화요일-일요일 11:00-18:00
              <br />
              hello@example.com
            </div>
          </div>
          <div className="footer-nav">
            <div className="footer-col">
              <h3>공방</h3>
              <SiteLink href="/intro">
                소개
              </SiteLink>
              <SiteLink href="/news">
                소식
              </SiteLink>
              <SiteLink href="/gallery">
                작업물
              </SiteLink>
            </div>
            <div className="footer-col">
              <h3>이용</h3>
              <SiteLink href="/class">
                함께하기
              </SiteLink>
              <SiteLink href="/shop">
                소장하기
              </SiteLink>
              <SiteLink href="/shop#custom">
                주문 상담
              </SiteLink>
            </div>
            <div className="footer-col">
              <h3>연결</h3>
              <a
                href={siteConfig.instagramUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Instagram
              </a>
              <a
                href={siteConfig.kakaoChannelUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                카카오채널
              </a>
              <SiteLink href="#">
                스토어
              </SiteLink>
            </div>
          </div>
        </div>
        <div className="footer-copy">
          &copy; 2026 {siteConfig.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
