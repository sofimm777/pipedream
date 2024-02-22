import notion from "../../notion.app.mjs";

export default {
  key: "notion-create-comment",
  name: "Create Comment",
  description: "Creates a comment in a page or existing discussion thread. [See the documentation](https://developers.notion.com/reference/create-a-comment)",
  version: "0.0.1",
  type: "action",
  props: {
    notion,
    pageId: {
      propDefinition: [
        notion,
        "pageId",
      ],
      description: "The identifier of the page to add a comment to",
    },
    discussionId: {
      type: "string",
      label: "Discussion ID",
      description: "The identifier for a discussion thread to add a comment to",
      optional: true,
      async options({ prevContext }) {
        const response = await this.notion._getNotionClient().comments.list({
          block_id: this.pageId,
          start_cursor: prevContext.nextPageParameters ?? undefined,
        });
        const options = response.results?.map(({
          id: value, rich_text: text,
        }) => ({
          value,
          label: text[0].plain_text,
        })) || [];
        return this._buildPaginatedOptions(options, response.next_cursor);
      },
    },
    comment: {
      type: "string",
      label: "Comment",
      description: "The text content of the comment",
    },
  },
  async run({ $ }) {
    const params = {
      rich_text: [
        {
          text: {
            content: this.comment,
          },
        },
      ],
    };
    if (this.discussionId) {
      params.discussionId = this.discussionId;
    } else {
      params.parent = {
        page_id: this.pageId,
      };
    }
    const response = await this.notion._getNotionClient().comments.create(params);
    $.export("$summary", `Successfully created comment with ID ${response.id}`);
    return response;
  },
};
