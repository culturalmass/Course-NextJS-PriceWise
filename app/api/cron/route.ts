import Product from "@/app/lib/models/product.model";
import { connectToDB } from "@/app/lib/mongoose";
import { generateEmailBody, sendEmail } from "@/app/lib/nodemailer";
import { scrapeAmazonProduct } from "@/app/lib/scraper";
import {
  getAveragePrice,
  getEmailNotifType,
  getHighestPrice,
  getLowestPrice,
} from "@/app/lib/utils";
import { NextResponse } from "next/server";

export const maxDuration = 10;
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    connectToDB();
    const products = await Product.find({});
    if (!products) throw new Error("No product fetched");

    // 1. SCRAPE LATEST PRODUCT DETAILS & UPDATE DB
    const updatedProducts = await Promise.all(
      products.map(async (currentProduct) => {
        const scrapedProduct = await scrapeAmazonProduct(currentProduct.url);
        if (!scrapedProduct) return;

        const updatedPriceHistory = [
          ...currentProduct.priceHistory,
          scrapedProduct.currentPrice,
        ];
        const product = {
          ...scrapedProduct,
          priceHistory: updatedPriceHistory,
          lowestPrice: getLowestPrice(updatedPriceHistory),
          highestPrice: getHighestPrice(updatedPriceHistory),
          averagePrice: getAveragePrice(updatedPriceHistory),
        };

        //Update products in DB

        const updatedProduct = await Product.findOneAndUpdate(
          { url: product.url },
          product
        );

        // 2. CHECK EACH PRODUCT'S STATUS & SEND EMAIL ACCORDINGLY
        const emailNotificationType = getEmailNotifType(
          scrapedProduct,
          currentProduct
        );
        if (emailNotificationType && updatedProduct.users.length > 0) {
          const productInfo = {
            title: updatedProduct.title,
            url: updatedProduct.url,
          };
          //Construct emailContent
          const emailContent = await generateEmailBody(
            productInfo,
            emailNotificationType
          );
          // Get array of user emails
          const userEmails = updatedProduct.users.map(
            (user: any) => user.email
          );
          // Send email notification
          await sendEmail(emailContent, userEmails);
        }
        return updatedProduct;
      })
    );
    return NextResponse.json({
      message: "Ok",
      data: updatedProducts,
    });
  } catch (error: any) {
    throw new Error(`Failed to get all products: ${error.message}`);
  }
}
