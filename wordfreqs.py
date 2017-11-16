#! /usr/bin/env python
# wordfreqs.py

""" Looks up word frequency rankings using wordfreq package.
"""

import sys
import wordfreq as wf


def freq(word, lang):
	return round(wf.word_frequency(word, lang) * 1e6)


def main(argv):
	lang = argv[-1]
	words = list(set(argv[:-1]))
	top5k = wf.top_n_list(lang, 5000)
	for word in words:
		#print(word, freq(word, lang))
		if word.lower() in top5k:
			print(word, top5k.index(word.lower()) + 1)


if __name__ == "__main__":
    main(sys.argv[1:])
