import path from 'path';
import fs from 'fs-extra';
import { TfIdf, TfIdfTerm } from 'natural';
import kuromoji from 'kuromoji';
import glob from 'glob';
const computeCosineSimilarity = require('compute-cosine-similarity');

// types
type BowVector = number[];
type GatsbyNode = {
  id: string;
  internal: {
    type: string;
    content: string;
  };
  frontmatter: { title: string };
  fileAbsolutePath: string;
};
type KuromojiTokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;
type Option = {
  posts_dir: string;
  doc_lang: string;
  bow_keyword_extracting_nums: number;
};

// settings
const default_option: Option = {
  posts_dir: process.cwd(),
  doc_lang: 'en',
  bow_keyword_extracting_nums: 30,
};

// utils
const calcVectorSimilarity = (v1: BowVector, v2: BowVector): number => {
  if (v1.length !== v2.length)
    throw new Error("Both vector's size must be equal");

  return computeCosineSimilarity(v1, v2);
};
type VectorWithId = { id: string; vector: BowVector };
const vector_similarity_memo = new Map<string, number>();
const getMemorizedVectorSimilarity = (
  v1: VectorWithId,
  v2: VectorWithId
): number => {
  const id = v1.id < v2.id ? `${v1.id} ${v2.id}` : `${v2.id} ${v1.id}`;

  const memorized_similarity = vector_similarity_memo.get(id);
  if (memorized_similarity !== undefined) return memorized_similarity;

  const similarity = calcVectorSimilarity(v1.vector, v2.vector);
  vector_similarity_memo.set(id, similarity);

  return similarity;
};

const getRelatedPosts = (
  id: string,
  bow_vectors: Map<string, BowVector>
): string[] => {
  const vector = bow_vectors.get(id);
  if (vector === undefined) throw new Error('invalid id');

  const vector_node: VectorWithId = {
    id,
    vector,
  };

  return Array.from(bow_vectors.entries())
    .sort((x, y) => {
      const vector_x: VectorWithId = {
        id: x[0],
        vector: x[1],
      };
      const vector_y: VectorWithId = {
        id: y[0],
        vector: y[1],
      };

      return (
        getMemorizedVectorSimilarity(vector_y, vector_node) -
        getMemorizedVectorSimilarity(vector_x, vector_node)
      );
    })
    .map((x) => x[0]);
};

const logline = (...msg: any): void =>
  console.log('[gatsby-remark-related-posts] ', ...msg);

const getTextFromMarkdown = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]+?```/g, '')
    .replace(/<.+?>/g, '')
    .replace(/http[^ ]+/g, '')
    .replace(/[\#\!\(\)\*\_\[\]\|\=\>\+\`\:\-]/g, '');

const getKuromojiTokenizer = async (): Promise<KuromojiTokenizer> =>
  new Promise((resolve, reject) => {
    kuromoji
      .builder({
        dicPath: path.join(
          path.dirname(require.resolve('kuromoji')),
          '../dict'
        ),
      })
      .build(function (err, tokenizer) {
        if (err) reject();
        resolve(tokenizer);
      });
  });

let kuromoji_tokenizer: KuromojiTokenizer | null = null;
const ja_tokendetail_whitelist = ['一般', '固有名詞'];
const getSpaceSeparatedDoc: {
  [key: string]: (doc: string) => Promise<string[]>;
} = {
  en: async (doc) => {
    return doc.toLowerCase().split(' ');
  },
  ja: async (doc) => {
    if (kuromoji_tokenizer === null)
      kuromoji_tokenizer = await getKuromojiTokenizer();

    return kuromoji_tokenizer
      .tokenize(doc)
      .filter((x) => ja_tokendetail_whitelist.indexOf(x.pos_detail_1) !== -1)
      .map((x) => (x.basic_form !== '*' ? x.basic_form : x.surface_form));
  },
};

// gatsby api
let bow_vectors: Map<string, BowVector> | null = null;

exports.onPreBootstrap = async (_: any, user_option: Partial<Option>) => {
  const option: Option = {
    ...default_option,
    ...user_option,
  };

  const markdown_paths = glob.sync(path.join(option.posts_dir, '/**/*.md'));

  const docs: { id: string; text: string }[] = await Promise.all(
    markdown_paths.map(async (x) => ({
      id: x,
      text: await (await fs.readFile(x)).toString(),
    }))
  );

  // add documents to tfidf
  const tfidf = new TfIdf();
  for (let doc of docs) {
    tfidf.addDocument(
      await getSpaceSeparatedDoc[option.doc_lang](getTextFromMarkdown(doc.text))
    );
  }

  // generate bow vectors
  type Term = TfIdfTerm & { tf: number; idf: number };
  //// extract keywords from each document
  const doc_terms = docs.map((_, i) =>
    (tfidf.listTerms(i) as Term[])
      .map((x) => ({ ...x, tfidf: (x as Term).tf * (x as Term).idf }))
      .sort((x, y) => y.tfidf - x.tfidf)
  );
  //DEBUG: print terms
  //doc_terms.forEach((x, i) =>
  //  console.log(
  //    docs[i].id,
  //    x.map((x) => x.term)
  //  )
  //);
  const all_keywords = new Set<string>();
  const tfidf_map_for_each_doc: Map<string, number>[] = [];
  doc_terms.forEach((x, i) => {
    tfidf_map_for_each_doc[i] = new Map<string, number>();
    x.slice(0, option.bow_keyword_extracting_nums).forEach((x) => {
      all_keywords.add(x.term);
      tfidf_map_for_each_doc[i].set(x.term, x.tfidf);
    });
  });
  //// generate vectors
  bow_vectors = new Map<string, BowVector>();
  docs.forEach((x, i) => {
    if (bow_vectors === null) return;
    bow_vectors.set(
      x.id,
      Array.from(all_keywords)
        .map((x) => tfidf_map_for_each_doc[i].get(x))
        .map((x) => (x === undefined ? 0 : x))
    );
  });

  logline('bow vectors generated, dimention: ', all_keywords.size);
};

exports.onCreateNode = ({
  node,
  actions,
}: {
  node: GatsbyNode;
  actions: any;
}) => {
  const { createNodeField } = actions;

  if (bow_vectors === null) return;
  if (node.internal.type !== 'MarkdownRemark') return;

  const related_paths = getRelatedPosts(
    node.fileAbsolutePath,
    bow_vectors
  ).slice(1);
  //DEBUG: print related posts
  //console.log(node.fileAbsolutePath, related_paths);

  createNodeField({
    node,
    name: 'relatedFileAbsolutePaths',
    value: related_paths,
  });
};
