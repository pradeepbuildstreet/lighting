import {buildListQuery,flattenCategories,pageHref,categoryHref} from './catalogue-client';
import type {CatalogueQuery} from './catalogue-types';
import type {ListingHelpers} from './catalogue-listing-model';
export const listingHelpers:ListingHelpers={buildListQuery:input=>buildListQuery(input as CatalogueQuery),flattenCategories,pageHref,categoryHref};
