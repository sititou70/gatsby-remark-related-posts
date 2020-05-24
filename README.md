# gatsby-remark-related-posts

Calculate related posts for each post using [tf–idf](https://en.wikipedia.org/wiki/Tf%E2%80%93idf).

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

## Licence

MIT
