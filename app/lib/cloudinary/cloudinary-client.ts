import { Cloudinary } from "@cloudinary/url-gen";

const cloudName = process.env?.CLOUDINARY_CLOUD_NAME || "";

const cld = new Cloudinary({
  cloud: {
    cloudName,
  },
  url: {
    secure: true, // force https, set to false to force http
  },
});

export default cld;
