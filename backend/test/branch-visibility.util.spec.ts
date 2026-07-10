import { resolveBranchFilter, resolveBranchFilterIncludingChurchWide } from '../src/common/branch-scope/branch-visibility.util';

describe('resolveBranchFilter', () => {
  it('is a no-op when unrestricted and no branch requested', () => {
    expect(resolveBranchFilter(undefined, null)).toEqual({});
  });

  it('passes through an explicit branchId when unrestricted', () => {
    expect(resolveBranchFilter('b-1', null)).toEqual({ branchId: 'b-1' });
  });

  it('scopes to the visible set when no branch requested', () => {
    expect(resolveBranchFilter(undefined, ['b-1', 'b-2'])).toEqual({ branchId: { in: ['b-1', 'b-2'] } });
  });

  it('honors an explicit branchId that is within the visible set', () => {
    expect(resolveBranchFilter('b-1', ['b-1', 'b-2'])).toEqual({ branchId: 'b-1' });
  });

  it('resolves to an impossible filter for a branchId outside the visible set', () => {
    const result = resolveBranchFilter('b-3', ['b-1', 'b-2']);
    expect(result.branchId).not.toBe('b-3');
    expect(result.branchId).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('resolves to an impossible filter when the visible set is empty and no branch requested', () => {
    expect(resolveBranchFilter(undefined, [])).toEqual({ branchId: { in: [] } });
  });

});

describe('resolveBranchFilterIncludingChurchWide', () => {
  it('also matches church-wide (null branchId) records when scoped and no branch requested', () => {
    expect(resolveBranchFilterIncludingChurchWide(undefined, ['b-1', 'b-2'])).toEqual({
      AND: [{ OR: [{ branchId: { in: ['b-1', 'b-2'] } }, { branchId: null }] }],
    });
  });

  it('is a no-op when unrestricted', () => {
    expect(resolveBranchFilterIncludingChurchWide(undefined, null)).toEqual({});
  });

  it('does not alter behavior when an explicit branchId is requested', () => {
    expect(resolveBranchFilterIncludingChurchWide('b-1', ['b-1', 'b-2'])).toEqual({ branchId: 'b-1' });
  });

  it('resolves to an impossible filter for a branchId outside the visible set', () => {
    expect(resolveBranchFilterIncludingChurchWide('b-3', ['b-1', 'b-2'])).toEqual({
      branchId: '00000000-0000-0000-0000-000000000000',
    });
  });
});
