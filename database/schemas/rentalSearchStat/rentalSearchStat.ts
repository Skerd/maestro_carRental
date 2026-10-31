import {Document, model, Schema, SchemaTypes, Types} from "mongoose";

/**
 * One counter per company, local day, category and pickup branch. The public
 * search increments it; the reports page reads the totals. Not a staff record.
 */
export interface IRentalSearchStat extends Document {
    company: Types.ObjectId;
    day: string;
    category: Types.ObjectId;
    location: Types.ObjectId;
    searches: number;
    unavailable: number;
}

const RentalSearchStatSchema = new Schema<IRentalSearchStat>({
    company: {type: SchemaTypes.ObjectId, required: true},
    day: {type: SchemaTypes.String, required: true},
    category: {type: SchemaTypes.ObjectId, required: true},
    location: {type: SchemaTypes.ObjectId, required: true},
    searches: {type: SchemaTypes.Number, default: 0},
    unavailable: {type: SchemaTypes.Number, default: 0},
});

RentalSearchStatSchema.index(
    {company: 1, day: 1, category: 1, location: 1},
    {unique: true},
);

const RentalSearchStat = model<IRentalSearchStat>(
    "RentalSearchStat",
    RentalSearchStatSchema,
);
export default RentalSearchStat;
