
import os
import json

DIR = './out'
for f in os.listdir(DIR):
    f = os.path.join(DIR, f)
    with open(f) as f:
        obj = json.load(f)
        p0 = obj['problems'][0]
        print(len(obj['problems']), str(p0['year']) + '-' + p0['exam_number'] + '\t' + p0['source'])
