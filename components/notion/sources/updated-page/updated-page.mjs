import notion from "../../notion.app.mjs";  
import sampleEmit from "./test-event.mjs";  
import base from "../common/base.mjs";  
import constants from "../common/constants.mjs";  
  
export default {  
 ...base,  
  key: "notion-updated-page",  
  name: "Updated Page in Database",  
  description: "Emit new event when a page in a database is updated. To select a specific page, use `Updated Page ID` instead",  
  version: "0.0.15",  
  type: "source",  
  dedupe: "unique",  
  props: {  
  ...base.props,  
   databaseId: {  
    propDefinition: [notion, "databaseId", "aa7ff0cd9ad1498a9dc03d2edf6c34a4"],  
   },  
   properties: {  
    propDefinition: [notion, "propertyTypes", (c) => ({ parentId: c.databaseId, parentType: "database", })],  
    description: "Only emit events when one or more of the selected properties have changed",  
    optional: true,  
   },  
   includeNewPages: {  
    type: "boolean",  
    label: "Include New Pages",  
    description: "Emit events when pages are created or updated. Set to `true` to include newly created pages. Set to `false` to only emit updated pages. Defaults to `false`.",  
    default: false,  
   },  
  },  
  hooks: {  
   async deploy() {  
    if (!this.properties?.length) {  
      return;  
    }  
    const propertyValues = {};  
    const pagesStream = this.notion.getPages(this.databaseId);  
    for await (const page of pagesStream) {  
      propertyValues[page.id] = {};  
      for (const property of this.properties) {  
       propertyValues[page.id][property] = JSON.stringify(page.properties[property]);  
      }  
    }  
    this._setPropertyValues(propertyValues);  
   },  
  },  
  methods: {  
  ...base.methods,  
   _getPropertyValues() {  
    return this.db.get("propertyValues");  
   },  
   _setPropertyValues(propertyValues) {  
    this.db.set("propertyValues", propertyValues);  
   },  
   async updateCoverImage(page) {  
    const cmValue = page.properties.CM;  
    let coverImageURL;  
    switch (cmValue) {  
      case "Period":  
       coverImageURL = "https://i.ibb.co/JdkCnFz/Period.png";  
       break;  
      case "Spotting":  
       coverImageURL = "https://i.ibb.co/HDHKDBW/Spotting.png";  
       break;  
      case "Follicular":  
       coverImageURL = "https://i.ibb.co/HDHKDBW/Follicular.png";  
       break;  
      case "Ovulation":  
       coverImageURL = "https://i.ibb.co/HDHKDBW/Ovulation.png";  
       break;  
      case "Luteal":  
       coverImageURL = "https://i.ibb.co/HDHKDBW/Luteal.png";  
       break;  
      case "Menstruation":  
       coverImageURL = "https://i.ibb.co/HDHKDBW/Menstruation.png";  
       break;  
      default:  
       coverImageURL = null;  
    }  
    if (coverImageURL) {  
      await this.notion.updatePage(page.id, {  
       cover: {  
        external: {  
          url: coverImageURL,  
        },  
       },  
      });  
    }  
   },  
  },  
  async run() {  
   const lastCheckedTimestamp = this.getLastUpdatedTimestamp();  
   const lastCheckedTimestampDate = new Date(lastCheckedTimestamp);  
   const lastCheckedTimestampISO = lastCheckedTimestampDate.toISOString();  
   const propertyValues = this._getPropertyValues();  
   const params = {  
    ...this.lastUpdatedSortParam(),  
    filter: {  
      timestamp: "last_edited_time",  
      last_edited_time: {  
       after: lastCheckedTimestampISO,  
      },  
    },  
   };  
   let newLastUpdatedTimestamp = lastCheckedTimestamp;  
   const pagesStream = this.notion.getPages(this.databaseId, params);  
   for await (const page of pagesStream) {  
    if (!this.isResultNew(page.last_edited_time, lastCheckedTimestamp)) {  
      break;  
    }  
    newLastUpdatedTimestamp = Math.max(newLastUpdatedTimestamp, Date.parse(page?.last_edited_time));  
    if (this.properties?.length) {  
      let propertyChangeFound = false;  
      for (const property of this.properties) {  
       const currentProperty = JSON.stringify(page.properties[property]);  
       if (!propertyValues[page.id] || currentProperty!== propertyValues[page.id][property]) {  
        propertyChangeFound = true;  
        propertyValues[page.id] = {  
         ...propertyValues[page.id],  
          [property]: currentProperty,  
        };  
       }  
      }  
      if (!propertyChangeFound) {  
       continue;  
      }  
    }  
    if (!this.includeNewPages && page?.last_edited_time === page?.created_time) {  
      continue;  
    }  
    await this.updateCoverImage(page);  
    const meta = this.generateMeta(  
      page,  
      constants.types.PAGE,  
      constants.timestamps.LAST_EDITED_TIME,  
      constants.summaries.PAGE_UPDATED,  
      true  
    );  
    this.$emit(page, meta);  
   }  
   this.setLastUpdatedTimestamp(newLastUpdatedTimestamp);  
   this._setPropertyValues(propertyValues);  
  },  
  sampleEmit,  
};
