import axios from "axios";
import * as cheerio from "cheerio";
import { extractCurrency, extractDescription, extractPrice } from "../utils";

export async function scrapeAmazonProduct(url: string) {
  if (!url) return;

  //BrightData proxy configuration
  //   curl --proxy brd.superproxy.io:22225 --proxy-user brd-customer-hl_4cfa11c6-zone-unblocker:ataz3kcsuwt1 -k https://lumtest.com/myip.json

  const username = String(process.env.BRIGHT_DATA_USERNAME);
  const password = String(process.env.BRIGHT_DATA_PASSWORD);
  const port = 22225;
  const session_id = (1000000 * Math.random()) | 0;
  const options = {
    auth: {
      username: `${username}-session-${session_id}`,
      password,
    },
    host: "brd.superproxy.io",
    port,
    rejectUnauthorized: false,
  };

  try {
    const response = await axios.get(url, options);
    const $ = cheerio.load(response.data);

    //Extract the product title
    const title = $("#productTitle").text().trim();
    const currentPrice = extractPrice(
      $(".priceToPay span.a-price-whole"),
      $(".a.size.base.a-color-price"),
      $(".a-button-selected .a-color-base")
    );
    const originalPrice = extractPrice(
      $("#priceblock_ourprice"),
      $(".a-price.a-text-price span.a-offscreen"),
      $("#listPrice"),
      $("#priceblock_dealprice"),
      $(".a-size-base.a-color-price")
    );
    const outOfStock =
      $("#availability span").text().trim().toLowerCase() ===
      "currently unavailable";
    const images =
      $("#imgBlkFront").attr("data-a-dynamic-image") ||
      $("#landingImage").attr("data-a-dynamic-image") ||
      "{}";
    const imageUrls = Object.keys(JSON.parse(images));
    const currency = extractCurrency($(".a-price-symbol"));

    // const discountRate = $(".savingPriceOverride").text().replace(/[-%]/g, "");
    const discountRate = $(".savingsPercentage")
      .text()
      .replace(/[%]/g, "")
      .split("-")[1];
    const description = extractDescription($);

    //Construct data object with scraped information
    const data = {
      url,
      currency: currency || "$",
      image: imageUrls[0],
      title,
      currentPrice:
        currentPrice.toLocaleString() || originalPrice.toLocaleString(),
      originalPrice:
        originalPrice.toLocaleString() || currentPrice.toLocaleString(),
      priceHistory: [],
      discountRate: discountRate === undefined ? 0 : Number(discountRate),
      category: "category",
      reviewsCount: 100,
      stars: 4.5,
      isOutOfStock: outOfStock,
      description,
      lowestPrice:
        currentPrice.toLocaleString() || originalPrice.toLocaleString(),
      highestPrice:
        originalPrice.toLocaleString() || currentPrice.toLocaleString(),
      averagePrice:
        currentPrice.toLocaleString() || originalPrice.toLocaleString(),
    };
    return data;
  } catch (error: any) {
    throw new Error(`Failed to scrape product_ ${error.message}`);
  }
}
