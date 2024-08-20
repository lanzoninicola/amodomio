import { Cloudinary } from "@cloudinary/url-gen";

const env = import.meta.env;
const cloudName = env?.CLOUDINARY_CLOUD_NAME || "";

const cld = new Cloudinary({
  cloud: {
    cloudName,
  },
  url: {
    secure: true, // force https, set to false to force http
  },
});

export default cld;
