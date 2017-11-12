#! /usr/bin/env python
# wordfreqs.py

""" Looks up word frequency rankings using wordfreq package.
"""

import sys
import wordfreq as wf


def freq(word, lang):
	return round(wf.word_frequency(word, lang) * 1e6)


def main(argv):
	#gr_words = ['μου', 'αρέσει', 'να', 'παρακολουθώ', 'τη', 'τηλεόραση', 'κάθε', 'ημέρα']
	lang = argv[-1]
	words = argv[:-1]
	for word in words:
		print(word, freq(word, lang))


if __name__ == "__main__":
    main(sys.argv[1:])
