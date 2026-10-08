# Edufin-pub

Research artifacts accompanying the paper **“A Production-Deployed Financial Education Assistant with Interpretable Retrieval over Expert-Curated Knowledge.”** The paper describes AIDA, an Italian financial-education assistant that combines an expert-curated knowledge base, sparse/fuzzy retrieval, and language-model generation.

- **Service:** [AIDA](https://aida.aief.eu/)
- **Research repository:** [unimib-whattadata/Edufin-pub](https://github.com/unimib-whattadata/Edufin-pub)

## Research artifact package

Download [`benchmark_150_additional_material.zip`](benchmark_150_additional_material.zip). It contains the research materials for the paper's in-domain retrieval and answer audits, including:

- the frozen catalogue of 89 curated knowledge-base entries;
- the 150-question audit data, educator annotations, and aggregate reports;
- production-retriever, BM25, multilingual E5, and reciprocal-rank-fusion comparison outputs and analysis scripts;
- a separate synthetic 36-prompt safety screen, its educator annotations, and reports;
- run manifests and supporting scripts for the reported analyses.

Start with `README_retrieval_annotation.md`, `README_answer_evaluation.md`, and `README_adversarial_safety.md` inside the archive for the dataset definitions and annotation protocols.

To verify the archive, run `shasum -a 256 -c SHA256SUMS` from the repository root.

## Scope and limitations

The 150-question audit comes from a pre-deployment educator study; it is not a sample of production user traffic. The safety screen uses synthetic prompts. The package does not include AIDA's production system prompt, credentials, or production user conversations. Some identity-bearing details were redacted in the released package, so it is not a byte-identical copy of the internal analysis inputs; the paper's aggregate results are the authoritative reported results. Some replay helpers also depend on an external application checkout, as described in the paper.

The paper is self-contained: the repository is provided for inspection and further analysis, not as a conference supplementary submission.

## License

No reuse license is currently specified for this repository. Public access does not by itself grant permission to redistribute or adapt the materials; contact the authors about reuse.
