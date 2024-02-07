import { Collection } from "mongodb";

interface MongoBaseEntityProps {
  model: Collection;
}

export interface FindPaginatedProps {
  pageNumber: number;
  pageSize: number;
}

export class MongoBaseEntity<T> {
  model;

  constructor({ model }: MongoBaseEntityProps) {
    if (!model) {
      throw new Error("Model is required");
    }

    this.model = model;
  }

  async findPaginated({ pageNumber, pageSize }: FindPaginatedProps) {
    // Calculate skip value based on pageNumber and pageSize
    const skip = (pageNumber - 1) * pageSize;

    // Find documents with pagination and convert the cursor to an array
    const documents = await this.model
      .find()
      .skip(skip)
      .limit(pageSize)
      .toArray();

    // Count total documents
    const totalDocuments = await this.model.countDocuments();

    // Calculate total pages
    const totalPages = Math.ceil(totalDocuments / pageSize);

    // Return the array of documents and total pages
    return { documents, totalPages };
  }
}
