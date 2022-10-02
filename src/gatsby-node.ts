import kuromoji from 'kuromoji';
import { TfIdf, TfIdfTerm } from 'natural';
import path from 'path';
import { GatsbyNode } from 'gatsby';
import crypto from 'crypto';
import { kStringMaxLength } from 'buffer';

const computeCosineSimilarity = require('compute-cosine-similarity');

// types
type BowVector = number[];
type KuromojiTokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;
type Option = {
  doc_lang: string;
  target_node: 'MarkdownRemark' | 'StrapiArticle';
  getMarkdown: (node: any) => string;
  each_bow_size: number;
};

// settings
const default_option: Option = {
  doc_lang: 'en',
  target_node: 'MarkdownRemark',
  getMarkdown: (node) => node.rawMarkdownBody,
  each_bow_size: 30,
};

// utils
const md5 = (str: string): string => {
  const md5 = crypto.createHash('md5');
  return md5.update(str, 'binary').digest('hex');
};

const calcVectorSimilarity = (v1: BowVector, v2: BowVector): number => {
  if (v1.length !== v2.length)
    throw new Error("Both vector's size must be equal");

  return computeCosineSimilarity(v1, v2);
};
type VectorWithId = {
  id: string;
  vector: BowVector;
};
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
  if (vector === undefined) return [];

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

const getTextFromMarkdown = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]+?```/g, '')
    .replace(/---[\s\S]+?---/g, '')
    .replace(/\$[\s\S]+?\$/g, '')
    .replace(/\$\$[\s\S]+?\$\$/g, '')
    .replace(/^\|.*\|$/gm, '')
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
      .filter(
        (x) =>
          x.pos === '名詞' &&
          ['一般', '固有名詞'].indexOf(x.pos_detail_1) !== -1
      )
      .map((x) => (x.basic_form !== '*' ? x.basic_form : x.surface_form));
  },
};

// gatsby api
export const createSchemaCustomization: GatsbyNode['createSchemaCustomization'] =
  ({ actions }, user_option) => {
    const option: Option = {
      ...default_option,
      ...user_option,
    };

    actions.createTypes(`
    type related${option.target_node}s implements Node {
      posts: [${option.target_node}]
    }
  `);
  };

export const onPostBootstrap: GatsbyNode['onPostBootstrap'] = async (
  { actions, getNode, getNodesByType, createNodeId, reporter, cache },
  user_option
) => {
  const option: Option = {
    ...default_option,
    ...user_option,
  };
  const nodes = getNodesByType(option.target_node);

  // add documents to tfidf
  const docs = nodes.map((node) => ({
    id: node.id,
    text: option.getMarkdown(node),
  }));

  const tfidf = new TfIdf();
  for (let doc of docs) {
    const key = `related-posts-ssd-${md5(doc.text)}`;

    const cached_ssd = await cache.get(key);
    if (cached_ssd !== undefined) {
      tfidf.addDocument(cached_ssd);
      continue;
    }

    const ssd = await getSpaceSeparatedDoc[option.doc_lang](
      getTextFromMarkdown(doc.text)
    );
    tfidf.addDocument(ssd);
    await cache.set(key, ssd);
  }

  // generate bow vectors
  type Term = TfIdfTerm & {
    tf: number;
    idf: number;
  };
  //// extract keywords from each document
  const doc_terms = docs.map((_, i) =>
    (tfidf.listTerms(i) as Term[])
      .map((x) => ({ ...x, tfidf: (x as Term).tf * (x as Term).idf }))
      .sort((x, y) => y.tfidf - x.tfidf)
  );
  // DEBUG: print terms
  // doc_terms.forEach((x, i) =>
  //  console.log(
  //    docs[i].id,
  //    x.map((x) => x.term)
  //  )
  //);
  const all_keywords = new Set<string>();
  const tfidf_map_for_each_doc: Map<string, number>[] = [];
  doc_terms.forEach((x, i) => {
    tfidf_map_for_each_doc[i] = new Map<string, number>();
    x.slice(0, option.each_bow_size).forEach((x) => {
      all_keywords.add(x.term);
      tfidf_map_for_each_doc[i].set(x.term, x.tfidf);
    });
  });
  //// generate vectors
  const bow_vectors = new Map<string, BowVector>();
  docs.forEach((x, i) => {
    if (bow_vectors === null) return;
    bow_vectors.set(
      x.id,
      Array.from(all_keywords)
        .map((x) => tfidf_map_for_each_doc[i].get(x))
        .map((x) => (x === undefined ? 0 : x))
    );
  });
  reporter.info(
    `[related-posts] bow vectors generated, dimention: ${all_keywords.size}`
  );

  // create related nodes
  nodes.forEach((node) => {
    const related_nodes = getRelatedPosts(node.id, bow_vectors)
      .slice(1)
      .map((id) => getNode(id));
    const digest = `${node.id} >>> related${option.target_node}s`;

    actions.createNode({
      id: createNodeId(digest),
      parent: node.id,
      internal: {
        type: `related${option.target_node}s`,
        contentDigest: digest,
      },
      posts: related_nodes,
    });
  });
};
