import { tester, plugin } from '../helpers.js';
const bad = code => ({ code, errors: [{ messageId: 'diagnostic' }] });
tester.run('no-impossible-length-comparison', plugin.rules['no-impossible-length-comparison'], {
  valid: ['length{Int}(xs)<0', 'length(xs...)<0', 'length(;xs)<0', 'length(xs)==0', 'length(xs)>0', 'length(xs)<=0', 'length(xs)<limit',
    'f(length,xs)=length(xs)<0', 'f(var"<",xs)=length(xs)<0', 'length(xs) .< 0',
    '-1 < length(xs) < 2', '@foo length(xs)<0', 'quote length(xs)<0 end',
    { code: 'length(xs)<0', options: [{ knownCollectionsOnly: true }] }],
  invalid: [bad('length(xs)<0'), bad('length(xs)>=0'), bad('-1 == length(xs)'),
    bad('length(α)!=-1'), bad('-1 < Base.length(xs)'), bad('length(xs)<=-2'),
    { ...bad('length([1,2])<0'), options: [{ knownCollectionsOnly: true }] },
    { ...bad('length("α")>=0'), options: [{ knownCollectionsOnly: true }] }],
});
