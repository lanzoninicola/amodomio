import { scale } from "@cloudinary/url-gen/actions/resize";
import cld from "./cloudinary-client";
import { CloudinaryImageInfo } from "./cloudinary.types";

export default class CloudinaryUtils {
  /**
   * Helper function to build cloudinary image info
   *
   * @param param0
   * @returns
   */
  static buildImageInfo({
    secureUrl,
    assetFolder,
    originalFileName,
    displayName,
    height,
    width,
    thumbnailUrl,
    format,
  }: CloudinaryImageInfo) {
    return {
      secureUrl,
      assetFolder,
      originalFileName,
      displayName,
      height,
      width,
      thumbnailUrl,
      format,
    };
  }

  /**
   * Resize an image to a specific width
   *
   * @param publicId The public id of the image from cloudinary
   * @param options The options to resize the image
   * @param options.width The width to resize the image
   * @returns  The url of the resized image
   */
  static scaleWidth(publicId: string, options = { width: 1280 }) {
    return (
      cld
        .image(publicId) // this is the public id
        .format("auto")
        .resize(scale().width(options.width))
        .toURL() || null
    );
  }
}
