# gatsby-remark-related-posts

[![npm version](https://badge.fury.io/js/gatsby-remark-related-posts.svg)](https://badge.fury.io/js/gatsby-remark-related-posts)

Calculate the similarity between posts and make it available from graphql.

To calculate the similarity, this plugin using [tf-idf](https://en.wikipedia.org/wiki/Tf%E2%80%93idf) and [Cosine similarity](https://en.wikipedia.org/wiki/Cosine_similarity).

## Installation

`npm i --save gatsby-remark-related-posts`

## Usage

In your `gatsby-config.js`:

```javascript
{
  resolve: "gatsby-remark-related-posts",
  options: {
    posts_dir: `${__dirname}/posts`,
    doc_lang: "ja",
  },
},
```

| option      | description                                                                  |
| :---------- | :--------------------------------------------------------------------------- |
| `posts_dir` | directory that includes your markdown files.                                 |
| `doc_lang`  | ISO 639-1 language code of your post. This supports `en` and `ja` currently. |

The plugin creates a new `relatedMarkdownRemarkNodes` field on each `MarkdownRemark` node, like this:

```javascript
// query
{
  allMarkdownRemark {
    nodes {
      frontmatter {
        title
      }
      fields {
        relatedMarkdownRemarks {
          frontmatter {
            title
          }
        }
      }
    }
  }
}
```

```javascript
// result
{
  "data": {
    "allMarkdownRemark": {
      "nodes": [
        {
          "frontmatter": {
            "title": "New Beginnings"
          },
          "fields": {
            "relatedMarkdownRemarks": [
              {
                "frontmatter": {
                  "title": "Hello World"
                }
              },
              {
                "frontmatter": {
                  "title": "My Second Post!"
                }
              }
            ]
          }
        },
        ...
```

These MarkdownRemark nodes are sorting by similarity. In this example, first "Hello World" post is the most related to "New Beginnings" post.

see also: [sample repo](https://github.com/sititou70/gatsby-remark-related-posts-example)

## Licence

MIT
