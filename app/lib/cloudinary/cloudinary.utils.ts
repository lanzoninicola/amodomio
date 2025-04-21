import { scale } from "@cloudinary/url-gen/actions/resize";
import cld from "./cloudinary-client";
import { CloudinaryImageInfo } from "./cloudinary.types";
import { quality } from "@cloudinary/url-gen/actions/delivery";
import { blur } from "@cloudinary/url-gen/actions/effect";

interface VideoURLOptions {
  width?: number;
}

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

  static scaleWidth(
    publicId: string,
    options: {
      width?: number;
      quality?: number;
      blur?: number;
    } = {}
  ) {
    if (!publicId) return null;

    const img = cld.image(publicId).format("auto");

    if (options.width) {
      img.resize(scale().width(options.width));
    }

    if (options.quality) {
      img.delivery(quality(options.quality));
    }

    if (options.blur) {
      img.effect(blur().strength(options.blur));
    }

    return img.toURL();
  }

  /**
   * https://cloudinary.com/documentation/javascript_video_transformations
   *
   * @param publicId The public id of the video from cloudinary
   * @returns
   */
  static getVideoURL(publicId: string, options: VideoURLOptions = {}) {
    const video = cld.video(publicId).format("auto");

    if (options.width) {
      video.resize(scale().width(options.width));
    }

    return video.toURL();
  }
}
