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

This creates a new `relatedFileAbsolutePaths` field on each `MarkdownRemark` node, like this:

```javascript
// query
query {
  allMarkdownRemark {
    nodes {
      fileAbsolutePath
      fields {
        relatedFileAbsolutePaths
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
          "fileAbsolutePath": "/home/user/blog/posts/markdown1.md",
          "fields": {
            "relatedFileAbsolutePaths": [
              "/home/user/blog/posts/markdown4.md",
              "/home/user/blog/posts/markdown2.md",
              "/home/user/blog/posts/markdown3.md"
            ]
          }
        },
        ...
      ]
    }
  }
}
```

These paths are sorting by similarity. In this example, first "/home/user/blog/posts/markdown4.md" is the most related to "/home/user/blog/posts/markdown1.md".

In addition, to see all the sample code for displaying related posts, please also refer to [gatsby-remark-related-posts-example](https://github.com/sititou70/gatsby-remark-related-posts-example).

See also [this blog post(Japanese)](https://sititou70.github.io/Gatsby%E8%A3%BD%E3%83%96%E3%83%AD%E3%82%B0%E3%81%A7%E8%87%AA%E7%84%B6%E8%A8%80%E8%AA%9E%E5%87%A6%E7%90%86%E3%81%97%E3%81%A6%E9%96%A2%E9%80%A3%E8%A8%98%E4%BA%8B%E3%82%92%E8%A1%A8%E7%A4%BA%E3%81%99%E3%82%8B/) for the motivation that created this plugin and internal algorithms.

## Licence

MIT
