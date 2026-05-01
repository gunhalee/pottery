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
              <Link href="/intro">About</Link>
              <Link href="/news">News</Link>
              <Link href="/gallery">Gallery</Link>
            </div>
            <div className="footer-col">
              <h3>Service</h3>
              <Link href="/class">Class</Link>
              <Link href="/shop">Shop</Link>
              <Link href="/shop#custom">Custom</Link>
            </div>
            <div className="footer-col">
              <h3>Connect</h3>
              <Link href="#">Instagram</Link>
              <Link href={siteConfig.kakaoChannelUrl}>Channel</Link>
              <Link href="#">Store</Link>
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
