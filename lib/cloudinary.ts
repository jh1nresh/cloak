import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadWithWatermark(
  imageUrl: string,
  tryonId: string
): Promise<string> {
  const result = await cloudinary.uploader.upload(imageUrl, {
    public_id: `cloak/tryons/${tryonId}`,
    transformation: [
      {
        overlay: {
          font_family: "Arial",
          font_size: 24,
          font_weight: "bold",
          text: "Cloak",
        },
        color: "#1A1A1A",
        opacity: 60,
        gravity: "south_east",
        x: 20,
        y: 20,
      },
    ],
  });

  return result.secure_url;
}

export async function uploadImage(
  imageBuffer: Buffer,
  folder: string,
  publicId: string,
  contentType?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: "image",
          format: formatForContentType(contentType),
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result.secure_url);
          } else {
            reject(new Error("Upload failed"));
          }
        }
      )
      .end(imageBuffer);
  });
}

export { cloudinary };

function formatForContentType(contentType?: string) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}
