import Link from "next/link";
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
              <h3>Brand</h3>
              <Link href="/intro" prefetch={false}>
                About
              </Link>
              <Link href="/news" prefetch={false}>
                News
              </Link>
              <Link href="/gallery" prefetch={false}>
                Gallery
              </Link>
            </div>
            <div className="footer-col">
              <h3>Service</h3>
              <Link href="/class" prefetch={false}>
                Class
              </Link>
              <Link href="/shop" prefetch={false}>
                Shop
              </Link>
              <Link href="/shop#custom" prefetch={false}>
                Custom
              </Link>
            </div>
            <div className="footer-col">
              <h3>Connect</h3>
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
                Channel
              </a>
              <Link href="#" prefetch={false}>
                Store
              </Link>
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
