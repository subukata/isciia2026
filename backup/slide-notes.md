# Speaker notes (backup)

The speaker notes of the slides, removed from `slides/index.html` on 2026-10-29: they are not used. They are copied here from
commit 12643e3, where each scene still has them as `<aside class="notes">` (`git show 12643e3:slides/index.html`).

Each scene: its number in the deck, its title and its id. "(→)" starts the next build step; " / " marks a pause.

## 1. Title (`title`)

[Introduction · 5 min]  
My talk is / "Uncertainty, Topology, and Graphs / in Prototype-Based Learning."  
**Please take a photo** of the QR code.  
It opens the talk site, / with the slides, papers, and code.  
The four panels here / are the four parts of this talk.  
I begin with k-means and FCM, / and then three parts present **our methods**.  
But first, / let me introduce myself.

## 2. About me (`about`)

I am **Seiki Ubukata**, / Associate Professor at the Graduate School of Informatics, / Osaka Metropolitan University.  
My research is on data clustering, / soft computing, / fuzzy theory, / rough set theory, / and self-organizing maps.

## 3. Overview of this talk (`outline`)

This is the overview of this talk.  
The introduction is clustering with k-means and FCM: / crisp clusters, then degrees.  
Part 1 is rough clustering by distances: / uncertain regions found by distances.  
Part 2 is rough clustering by neighborhoods: / uncertainty by neighborhoods, / and graphs from overlaps.  
Part 3 is topographic mapping: / prototypes kept in order on a map.  
All of these methods / are **prototype-based learning**.  
Green names are **our methods**.  
The thread of the talk / goes from rule-based updates / to one objective.

## 4. Why clustering (`why`)

This slide shows / that clustering groups data, / and a prototype summarizes a group.  
Most data come without labels, / so we look for the groups in them.  
On the left, / the data points have no labels.  
In the middle, / clustering finds 3 groups.  
On the right, / each group is summarized by a prototype.  
k-means is the standard way / to find these prototypes.

## 5. k-means minimizes one objective by two alternating updates (`kmeans`)

Good prototypes / are close to their data points.  
A clustering is not only its prototypes / but also its assignment: / the cluster of each data point.  
So **we need** one measure / of how good this cluster structure is.  
Here, / each data point is joined to its prototype.  
**k-means** is a clustering method / that represents each cluster / by the mean of its data points.

(→) So k-means minimizes one objective.  
We split the data points into C clusters, / and here C is 3.  
The membership u_ci says / which cluster data point i is in.  
So choosing u / is the clustering.  
Then, / the objective **J** measures the fit: / the squared distance from each data point to its prototype, / summed over all data points.  
In J, / u_ci is 1 if i is in c, / and 0 otherwise.  
x_i is data point i, / and b_c is the prototype of cluster c.

(→) k-means minimizes J / by two alternating updates.  
We minimize J **in turns**: / assign with the prototypes fixed, / then average.  
With b fixed, / each data point goes to the nearest prototype.  
With u fixed, / each prototype moves to the mean.  
Each update minimizes J, / so J **never increases**.

## 6. FCM expresses the boundary by degrees (`fuzzy`)

k-means splits clusters / with a crisp boundary.  
So it **cannot express** / how ambiguous the boundary is.  
This is a new example / with two overlapping groups.  
Here, / k-means puts each data point near the boundary / in one cluster only.  
**FCM**, fuzzy c-means, / is fuzzy clustering: / it extends the discrete membership, 0 or 1, / to a continuous membership / between 0 and 1.

(→) So FCM expresses the boundary / by degrees.  
The nearer a prototype, / the larger the degree, / and each data point's degrees add up to 1.  
FCM, or fuzzy c-means, / is a clustering method / that gives each data point a degree of membership in every cluster.

(→) FCM uses the same J as k-means, / but membership is a degree, / softened by the power m.  
u_ci is between 0 and 1, / and it sums to 1 over the clusters.  
m, which is greater than 1, / is the fuzzifier.  
The larger m is, / the softer the degrees are.

(→) Both updates minimize J: / degrees from distances, / and prototypes as weighted means.  
u_ci is the degree of membership, / larger for clusters that are relatively nearer, / and each prototype is a weighted mean.  
So J **never increases**.

## 7. Outline · Part 1 (`toc1`)

[Part 1 · 5.5 min]  
Part 1 is rough clustering / by distances.  
It finds uncertain regions between clusters / by distances.  
We go from RCM / to its family of thresholds: / GRCM and ExRCM.

## 8. Rough c-means (RCM) clustering (`rough`)

This is rough c-means, or RCM, clustering.  
In RCM, / a data point belongs to all **relatively close** clusters.  
RCM builds on rough set theory, / a theory of sets with **certain** and **possible** members.  
On the left, / FCM gives every data point a degree.  
On the right, / RCM gives each cluster certain and possible members.  
So RCM handles **overlapping membership**.  
And it extracts a **clear boundary**: / the data points in both clusters, / shown as diamonds.

(→) To let a data point belong to several clusters, / RCM uses the upper membership, u-bar_ci.  
Data point i belongs to every cluster / at most beta farther than the nearest one.  
For those clusters, / u-bar_ci is 1.  
d_ci is the distance from i to prototype c, / and d_i min is the distance to the nearest one.  
The solid circle shows d_i min, / and the dashed circle adds beta to it.  
So beta is the slack.  
This boundary data point is shown up close.  
As beta changes, / i belongs to both clusters, / or to one cluster only.

(→) A data point in two clusters / counts one half in each, / and each prototype is the weighted mean.  
The dashed lines / give one half to each of its clusters.  
But two classic rules / set this threshold differently.

## 9. GRCM and ExRCM generalize the RCM thresholds (`family`)

This slide shows / that GRCM and ExRCM generalize the RCM thresholds.  
Lingras adds a difference, beta, / and Peters a ratio, alpha.  
We proposed generalized RCM, or GRCM, / which takes both.  
We also proposed exponentiated RCM, or ExRCM, / which adds a power p.  
[Drag a star: all panels follow.]  
So we can **adjust** how the boundary is extracted, / with alpha, beta, and p.

## 10. ExRCM's exponent p changes the cluster shape (`shapes`)

ExRCM's exponent p / changes the cluster shape.  
Every panel uses the same rule, / with alpha equal to 1 and a shared beta, / and only p changes.  
Dark orange is the center cluster's **lower approximation**.  
Dark and light orange together / are its **upper approximation**.  
With p equal to 1, / the sides are **bulging**.  
With p equal to 2, / they are **straight**.  
With p equal to 4, / they are **bent inward**.  
And with p equal to 16, / the cluster is **a star**.  
So ExRCM captures clusters **flexibly**.  
One exponent p / makes the lower approximation round, polygonal, or star-shaped.  
Yet every rule / judges a data point by its distances alone.  
[End of Part 1]

## 11. Outline · Part 2 (`toc2`)

[Part 2 · 6 min]  
Part 2 is rough clustering / by neighborhoods.  
It finds uncertainty by neighborhoods, / with rough set theory.  
We go from rough membership / to RMCM2 and recommendation, / and end with a concept: / graphs.

## 12. Rough sets judge each data point by its neighborhood (`roughset`)

This slide shows / that in rough set theory, / neighborhoods give rise to uncertainty.  
A data point is seen / only through its neighbors.  
If they are in different clusters, / its cluster is **uncertain**.  
**So we** judge each data point by its neighborhood, / not by distance.  
Here are the neighborhoods of three data points: / two are certain, / and one is uncertain.

(→) So rough sets judge each data point / by its neighborhood.  
The neighborhood of a data point / is every data point within a radius delta, / itself included.  
If all neighbors of a data point are in a cluster, / the data point is certainly in it.  
If only some are, / it is possibly in it.  
Here is one data point, up close.  
As delta shrinks, / N_i becomes pure, / and i becomes certain.

## 13. Rough membership grades a data point by its neighbors (`granule`)

Rough membership / grades a data point by its neighbors.  
It is the share of a data point's neighbors / that are in the cluster.  
X_c is the set of data points in cluster c, / with labels from k-means.  
Here is one data point, up close, / with its mu for cluster 1.  
As delta shrinks, / all of its neighbors are in cluster 1, / and mu reaches 1.

(→) If all neighbors are in the cluster, / the data point is certain.  
If its neighbors are in both clusters, / it is possibly in either.  
So mu equal to 1 means / certainly in c.  
And mu between 0 and 1 means / possibly in c, / in the boundary.  
So mu_ci is a neighborhood-induced fuzzy membership.  
We can extract certain and uncertain regions / by mu_ci.

## 14. RMCM2 puts rough membership into one objective (`objective`)

This slide shows / that RMCM2 puts rough membership into one objective.  
We proposed objective-based rough membership c-means, / RMCM2.  
RMCM2 minimizes the k-means objective / with rough membership in place of the crisp assignment.  
In J, / mu, the rough membership, / takes the place of u.  
The lines are the errors in J, / weighted by mu.  
The dashed circle is the neighborhood / of one data point.  
Its neighbors are in both clusters, / so its error goes to **both** prototypes.  
As delta changes, / the neighborhood and the lines change with it.

(→) The update rules of the labels and the prototypes / are derived by minimizing J.  
Labels go by the smaller cost q, / and prototypes are mu-weighted means.  
q_cj is b_c's error / over the data points with j in their neighborhoods.  
The dashed circle / shows these data points.  
P_ij is one over the size of N_i / if j is in N_i, / and 0 otherwise.  
Here, / j goes to the cluster / with the smaller q.  
Each update minimizes J, / so J **never increases**.

## 15. Recommendation uses overlapping clusters (`cfex`)

This slide shows / that recommendation uses overlapping clusters.  
We applied our rough clustering methods / to collaborative filtering, / that is, recommender systems.  
The goal is to recommend to each user / an item they have not rated yet.  
The new example is ratings / of 7 users for 6 items.  
Each user x_i is a row of ratings from 1 to 5, / and a dash means not rated.

(→) With overlapping clusters, / C equal to 2, / x_4, between the groups, / belongs to both.  
b_1 and b_2 are the prototypes: / each cluster's mean rating of each item.  
A dash counts as 0.

(→) Users in a cluster have similar tastes.  
So an item with a high mean there / is likely to be liked.  
From each of a user's clusters, / we recommend its most popular unrated item.  
So x_4 gets two.  
Taking uncertainty into account / **improved** recommendation performance.

## 16. Overlapping clusters could form a prototype graph (`graph`)

Finally, / overlapping clusters / could form a prototype graph.  
This is a concept / that we are working toward.  
Overlaps could also show how clusters connect: / the shape, or topology, of the data.  
This new example is a ring, / with ExRCM and 8 prototypes.  
With ExRCM or RMCM2, / shared data points glue neighboring clusters into a graph.  
Here, / the graph is a **loop**.  
[End of Part 2]

## 17. Outline · Part 3 (`toc3`)

[Part 3 · 7.5 min]  
Part 3 is topographic mapping.  
It lays out high-dimensional data / on a low-dimensional map, / with prototypes kept in order.  
We go from the SOM to SOM-OLP, / with one objective.

## 18. Why topographic maps (`maps`)

This slide shows / that a low-dimensional map lets us see high-dimensional data.  
We want to see data with many dimensions, / which cannot be drawn directly.  
So **we need** the few dimensions / the data really vary in.  
The **manifold hypothesis** says / that such data often lie near a low-dimensional surface.  
Here, / the surface is 2D in 3D.  
On the right, / a 2D topographic map lays the surface flat.  
The **self-organizing map**, or SOM, / learns such a map / with ordered prototypes.

## 19. The SOM orders prototypes on a lattice (`som`)

The SOM / orders prototypes on a lattice.  
First, / an input x comes in.  
Then, / its nearest prototype is found: / the winner w.  
Then, / the winner and the nodes near it in the latent space / move toward x together.  
In the update, / node c moves toward the input / at the rate alpha.  
h of c and w / pulls the winner's neighbors too.  
r_c is node c on the lattice, / and sigma is the reach.  
The shading on the right is h of c and w: / largest at the winner, / and less for its lattice neighbors.  
After a few inputs, / we **fast-forward**.

(→) In batch SOM, / each node moves to a weighted mean of all data points.  
w_i is the winner of data point i.  
In the data space, / the lattice unfolds.  
But on the lattice, / a data point can only sit on its winner node.  
So, / can each data point have its own position / on the lattice?

## 20. SOM-OLP gives each data point a position on the lattice (`latent`)

This slide shows / that SOM-OLP gives each data point a position on the lattice.  
We proposed SOM with optimized latent positions, / or SOM-OLP.  
Each data point gets its own continuous position, v_i, / on the lattice.  
On the left, / batch SOM puts the data points on the nodes, / spread out to be seen.  
On the right, / SOM-OLP puts them between the nodes.  
So the map shows **each data point**, / not just its node.  
And v_i is a **variable**, / learned with the prototypes under one objective.

## 21. SOM-OLP moves a data point smoothly on the lattice (`probe`)

SOM-OLP moves a data point / smoothly on the lattice.  
We move one input, x, / across the data space, / and watch where it lands on the lattice.  
[Drag x.]  
The SOM winner jumps from node to node, / but the latent position v moves smoothly.  
So how is v found?

## 22. SOM-OLP minimizes one objective in closed form (`bcd`)

SOM-OLP adds one variable: / the latent position.  
We have the SOM's prototypes b / and memberships u, / which are soft winners.  
And we add a new variable: / each data point's latent position, v_i.  
We find all three by minimizing one objective, / so that no update makes it worse.  
The memberships u link the data space / and the latent space.

(→) So SOM-OLP minimizes one objective.  
The objective has three terms: / data fit, / lattice distance of each position v, / and entropy of u.  
r_c is node c's place / on the lattice.  
Gamma and lambda weigh / the lattice distance and the entropy.  
q_ci, the data fit plus the lattice distance, / is the cost of node c for data point i.

(→) SOM-OLP minimizes J in closed form, / one block at a time.  
We fix two blocks of variables / and minimize over the third.  
u is a softmax, / v is a mean of nodes, / and b is a mean of data.  
Each block update minimizes J over its block, / so J **never increases**.  
One iteration costs order n C, / with n data points and C nodes.  
Heskes's energy, / in contrast, / costs order n C squared.

## 23. Iris on a 16 × 16 map (`iris`)

Here is Iris / on a 16 by 16 map.  
We checked SOM-OLP on real data: / Iris, flowers with 4 features.  
SOM-OLP places flowers between the nodes, / and the species keep their order.  
The parameters are the ones tuned for Iris / in the public implementation.  
So this shows the layout, / not better performance.

## 24. Digits on a 16 × 16 map (`digits`)

Here is Digits / on a 16 by 16 map.  
The data are 64-dimensional: / images of 8 by 8 pixels.  
With SOM-OLP, / each digit gathers in its own region.  
[Hover over a data point to show its image.]  
[End of Part 3]

## 25. Summary (`principle`)

This is a summary of what we did.  
We handled uncertainty and topology with prototypes, / moving from rules to one objective.  
In Part 1, / with ExRCM, / we unified the RCM thresholds, / and one exponent shapes the clusters flexibly.  
In Part 2, / RMCM2 handles uncertainty through neighborhoods, / inside one objective.  
In Part 3, / with SOM-OLP, / each data point gets its own latent position on the map, / under one objective.

## 26. Thank you (`end`)

That is the end of my talk.  
**Thank you** for your attention.  
The QR code opens the talk site, / with the slides, papers, and code.

## 27. Supplementary material (`supp`)

(Supplement divider)  
The talk ends here, / and the slides that follow are for questions.  
They cover RSCM and RMCM for Part 2, / and Heskes's SOM for Part 3.

## 28. Supplement · RSCM and RMCM (`rscm`)

(Supplement, for questions)  
We first proposed RSCM and RMCM, / which use rough membership in rules.  
RSCM uses lower and upper regions, / and RMCM uses weights.  
Unlike RMCM2, / neither of them minimizes one objective.

## 29. Supplement · Heskes\'s SOM (`heskes`)

(Supplement, for questions)  
SOM updates are rules / that decrease no known function.  
**So we want** SOM learning / to minimize one energy, / as k-means does.  
Here is batch SOM on the surface.

(→) Heskes's SOM / minimizes one energy.  
Heskes chooses each winner / by how well its whole lattice neighborhood fits the data point.  
Then one energy is minimized.  
On the left is a data point x on the surface.  
On the right, / the lattice shows its nearest node and its winner.

(→) One energy covers all the errors, / and each winner is chosen / to make its own term smallest.  
h of c and w_i / is large near the winner.  
On the same surface and lattice, / the energy-based winner can differ from the nearest node.  
Here, / it differs for many data points.

(→) Every candidate's term / sums over all nodes.  
So each iteration needs / order n C squared work.  
SOM-OLP, / in contrast, / keeps one objective / without this cost.

## Not in the deck: RCM and rough sets give different boundaries (`disagree`)

RCM judges a data point by its distance, / and rough sets judge it by its neighborhood.  
We run both methods / on the same data.  
By distance, / this data point waits in the boundary.  
Yet all of its **10 neighbors** / are in one cluster.

(→) So distance and neighborhoods **can disagree**.  
By distance, / 16 data points are undecided, / but by neighborhoods, / only 10 are.  
The ringed ones / are certain by their neighborhoods.  
So we let the neighborhood decide, / with rough membership.
