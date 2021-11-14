# gatsby-remark-related-posts v2

[![npm version](https://badge.fury.io/js/gatsby-remark-related-posts.svg)](https://badge.fury.io/js/gatsby-remark-related-posts)

Calculate the similarity between posts by [tf-idf](https://en.wikipedia.org/wiki/Tf%E2%80%93idf) and [Cosine similarity](https://en.wikipedia.org/wiki/Cosine_similarity).

## Installation

`npm i --save gatsby-remark-related-posts`

## Example projects

- with Markdown: [gatsby-remark-related-posts-example](https://github.com/sititou70/gatsby-remark-related-posts-example)
- with Mdx: [gatsby-remark-related-posts-example-mdx](https://github.com/sititou70/gatsby-remark-related-posts-example-mdx)
- with Strapi: [gatsby-remark-related-posts-example-strapi](https://github.com/sititou70/gatsby-remark-related-posts-example-strapi)

## Usage

```javascript
// In your gatsby-config.js
plugins: [
  // ... other plugins
  `gatsby-remark-related-posts`,
  // ... other plugins
];
```

or

```javascript
// In your gatsby-config.js
plugins: [
  // ... other plugins
  {
    resolve: 'gatsby-remark-related-posts',
    options: {
      doc_lang: 'en', // optional
      target_node: 'MarkdownRemark', // optional
      getMarkdown: (node) => node.rawMarkdownBody, // optional
      each_bow_size: 30, // optional
    },
  },
  // ... other plugins
];
```

| option          | type                                                                     | description                                                                                         |
| :-------------- | :----------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `doc_lang`      | "en" \| "ja" (default: "en")                                             | ISO 639-1 language code of your post.                                                               |
| `target_node`   | "MarkdownRemark" \| "Mdx" \| "StrapiArticle" (default: "MarkdownRemark") | Gatsby node name to calculate similarity.                                                           |
| `getMarkdown`   | Function: (node) => string (default: (node) => node.rawMarkdownBody)     | Function to get Markdown text from Gatsby node.                                                     |
| `each_bow_size` | number (default: 30)                                                     | Adjust the size of the Bow vector. If you encounter problems during build, set it to a small value. |

## Querying Example

```javascript
// query
`
{
  relatedMarkdownRemarks(parent: {id: {eq: $markdownRemarksId}}) {
    posts {
      frontmatter {
        title
      }
      fields {
        slug
      }
    }
  }
}
`;
```

```javascript
// result
{
  "data": {
    "relatedMarkdownRemarks": {
      "posts": [
        {
          "frontmatter": {
            "title": "English language"
          },
          "fields": {
            "slug": "/11/"
          }
        },
        {
          "frontmatter": {
            "title": "Japanese language"
          },
          "fields": {
            "slug": "/12/"
          }
        },
        {
          "frontmatter": {
            "title": "Spanish language"
          },
          "fields": {
            "slug": "/13/"
          }
        },
        // ...
      ]
    }
  },
}
```

`posts` is array of `MarkdownRemark` ordered by related to `$markdownRemarksId`.

## Licence

MIT
